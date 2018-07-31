var diskspace = require('diskspace');
var http = require('http');
var qs = require('querystring');
var moment = require('moment');

// 当天信息
var m_nPicSavMax = 500; //允许缓存的最大图片数
var m_nDate = 0;        //当前日期
var m_nPicNum = 0;      //当前日期处理的图片数量
var m_nPicBytes = 0;    //当前日期处理的图片大小
var m_nRefNum = 0;      //当前日期拒绝的图片数量
var m_nRefBytes = 0;    //当前日期拒绝的图片大小

// 磁盘信息
var m_nFreeBytes = 0;     //空闲容量
var m_nTotalBytes = 0;    //总容量

module.exports = {
    //访问图片统计
    get_num : 0,        //访问图片的请求数
    get_success : 0,    //成功访问数

    //上传图片统计
    post_num : 0,       //上传图片请求数
    post_success : 0,   //上传成功数，不一定保存成功

    saving_num : 0,     //正在执行的图片保存任务数

    last_post : 0,      //最后一次收到图片的时间
    last_save : 0,      //最后一次保存图片的时间

    // 服务器属性
    server_ip : '-',    //图片服务器IP,不一定跟配置中一样
    server_port : '-',  //图片服务器端口
    server_home : '-',  //图片服务器根路径

    // 信息统计服务器的属性
    center_ip : '-',   //统计服务器IP
    center_port : '-'  //统计服务器端口
};

//检查能否处理上传图片请求
module.exports.add_state = function (err) {
    //未处理完成的任务数
    if(this.saving_num >= m_nPicSavMax) {
        console.log("saveing num is ", this.saving_num);
        err = "saving file is max";
        return false;
    }
    //磁盘剩余空间 1G = 1024*1024*1024
    if (this.free_space < 1073741824) {
        console.log("free space is ",this.free_space);
        err = "free space is " + this.free_space;
        return false;
    }
    return true;
};

module.exports.add_pic = function (bytes) {
    var today = moment().format('YYYY-MM-DD');
    if (m_nDate == today) {
        ++m_nPicNum;
        m_nPicBytes += bytes;
    } else {
        m_nDate = today;
        m_nPicNum = 1;
        m_nPicBytes = bytes;
    }
};

module.exports.add_refuse = function (bytes) {
    var today = moment().format('YYYY-MM-DD');
    if (m_nDate == today) {
        ++m_nRefNum;
        m_nRefBytes += bytes;
    } else {
        m_nDate = today;
        m_nRefNum = 1;
        m_nRefBytes = bytes;
    }
};
  
//上传状态
function upstate(o) {
    //获取当前磁盘空间
    var disk_path = o.server_home[0];
    console.log('store disk is ' + disk_path);
    diskspace.check(disk_path, function (err, result) {
        m_nTotalBytes = result.total;
        m_nFreeBytes = result.free;
    });

    //发送的数据
    var data = {
        server_ip : o.server_ip,
        server_port : o.server_port,
        get_num : o.get_num,
        get_success : o.get_success,
        post_num : o.post_num,
        post_success : o.post_success,
        saving_num : o.saving_num,
        last_post : o.last_post,
        last_save : o.last_save,
        date : m_nDate,
        pic_num : m_nPicNum,
        pic_bytes: m_nPicBytes,
        ref_num : m_nRefNum,
        ref_bytes : m_nRefBytes,
        free_space : m_nFreeBytes,
        total_space : m_nTotalBytes,
    }
    var content = qs.stringify(data);  
    console.log(data);
    
    var options = {  
        hostname: o.center_ip,  
        port: o.center_port,  
        path: '/imageCenter/update',  
        method: 'POST',
        headers: {  
            'Content-Type': 'application/x-www-form-urlencoded'  
        }
    }; 
    
    // 发送请求
    var req = http.request(options, function (res) {  
        console.log('response STATUS: ' + res.statusCode);  
        //console.log('HEADERS: ' + JSON.stringify(res.headers));  
        res.setEncoding('utf8');  
        res.on('data', function (chunk) {  
            console.log('response: ' + chunk);  
        });  
    });  
    
    req.on('error', function (e) {  
        console.log('problem with request: ' + e.message);  
    });  
    
    // write data to request body  
    req.write(content);
    
    req.end();

};

module.exports.run = function () {
    //获取当前磁盘空间
    var disk_path = this.server_home[0];
    console.log('store disk is ' + disk_path);

    diskspace.check(disk_path, function (err, result) {
        m_nTotalBytes = result.total;
        m_nFreeBytes = result.free;
    });

    //上传状态定时器
    setInterval(upstate, 60000, this);
};