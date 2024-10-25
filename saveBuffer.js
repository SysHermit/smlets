const sqlite3 = require('sqlite3').verbose();
const { Buffer } = require('buffer');

const db = new sqlite3.Database('your_database_file.db');
const dict = []; // 用于维护字符串字典

// 写入整数类型，4字节
function writeInteger(int) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(int);
    return buffer;
}

// 将字符串编码成带0x00终止的 Uint8Array
function encodeString(str) {
    const encoder = new TextEncoder();
    const encodedStr = encoder.encode(str);
    const buffer = new Uint8Array(encodedStr.length + 1); // 末尾多一位0x00终止
    buffer.set(encodedStr);
    buffer[buffer.length - 1] = 0x00;
    return buffer;
}

// 写入字符串，同时使用字典查找
function writeString(str) {
    const result = [];

    if (str === null) {
        // 写入 null 标志 0x02
        result.push(0x02);
        return new Uint8Array(result);
    }

    if (str === "") {
        // 写入空字符串 0x00 + 0x00 终止
        result.push(0x00, 0x00);
        return new Uint8Array(result);
    }

    // 查找字典，若存在则写入0x01 + 索引位置
    const dictIndex = dict.indexOf(str);
    if (dictIndex !== -1) {
        result.push(0x01);
        result.push(...new Uint32Array([dictIndex]).buffer); // 作为 DWORD 写入索引
        return new Uint8Array(result);
    }

    // 若为新字符串，则写入 0x01 + 0xFFFFFFFF + 编码字符串 + 添加到字典
    result.push(0x01);
    result.push(0xFF, 0xFF, 0xFF, 0xFF); // DWORD 值 0xFFFFFFFF

    const encodedStr = encodeString(str);
    result.push(...encodedStr);

    dict.push(str); // 将字符串加入字典
    return new Uint8Array(result);
}

// 将每行数据转换为 Buffer，逐列处理
function rowToBuffer(row) {
    const buffers = [];

    // 处理 tbl_name 字段
    const tblNameBuffer = writeString(row.tbl_name);
    buffers.push(tblNameBuffer);

    // 处理 tbl_col_name 字段
    const tblColNameBuffer = writeString(row.tbl_col_name);
    buffers.push(tblColNameBuffer);

    // 处理 idx 字段
    const idxBuffer = writeInteger(row.idx);
    buffers.push(idxBuffer);

    // 处理 en_us 字段
    const enUsBuffer = writeString(row.en_us);
    buffers.push(enUsBuffer);

    // 合并所有字段 Buffer 并返回
    return Buffer.concat(buffers);
}

// 读取表数据并转换为 Buffer 格式
function tableToBuffer() {
    return new Promise((resolve, reject) => {
        const finalBuffers = [];

        db.each("SELECT tbl_name, tbl_col_name, idx, en_us FROM your_table_name", (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            // 将每行转换为 Buffer 并添加到结果列表
            const rowBuffer = rowToBuffer(row);
            finalBuffers.push(rowBuffer);
        }, (err, count) => {
            if (err) {
                reject(err);
            } else {
                // 合并所有行的 Buffer 并返回
                resolve(Buffer.concat(finalBuffers));
            }
        });
    });
}

// 调用转换函数并输出结果
tableToBuffer().then(buffer => {
    console.log(buffer);
    // 可以将 buffer 写入文件或用于其他目的
}).catch(err => {
    console.error("Error:", err);
});
