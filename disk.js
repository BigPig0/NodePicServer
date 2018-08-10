var diskspace = require('diskspace');

// 磁盘信息
var m_nFreeBytes = 0;     //空闲容量
var m_nTotalBytes = 0;    //总容量
var m_diskPath;           //存储位置

function checkDiskInfo () {
    console.log('store disk is ' + m_diskPath);
    diskspace.check(m_diskPath, function (err, result) {
        m_nTotalBytes = result.total;
        m_nFreeBytes = result.free;
    });
}

module.exports.set_disk_path = function (disk_path) {
    m_diskPath = disk_path[0];
    checkDiskInfo();
};

module.exports.get_disk_info = function () {
    setImmediate(checkDiskInfo); //重新获取磁盘信息
    return {
        free_bytes : m_nFreeBytes,
        total_bytes : m_nTotalBytes
    };
};

//检查能否处理上传图片请求
module.exports.add_state = function (err) {
    //磁盘剩余空间 1G = 1024*1024*1024
    if (m_nFreeBytes < 1073741824) {
        console.log("free space is ",m_nFreeBytes);
        err = "free space is " + m_nFreeBytes;
        return false;
    }
    return true;
};