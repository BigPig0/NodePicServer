var diskspace = require('diskspace');
var http = require('http');
var qs = require('querystring');
var moment = require('moment');

//访问图片统计
var    m_nGetNum = 0;        //访问图片的请求数
var    m_nGetSucess = 0;     //成功访问数

//上传图片统计
var    m_nPostNum = 0;       //上传图片请求数
var    m_nPostSucess = 0;    //上传成功数，不一定保存成功

var    m_nPicSavNum = 0;    //正在执行的图片保存任务数
var    m_nPicSavMax = 5000;    //允许的最多图片任务数

var    m_nLastPicPostTime = 0;  //最后一次收到图片的时间
var    m_nLastPicSaveTime = 0;  //最后一次保存图片的时间

var    m_nFreeBytes = 0;   //空闲容量
var    m_nTotalBytes = 0;  //总容量

// 服务器属性
var   m_strIP;        //图片服务器IP,不一定跟配置中一样
var   m_strPort;      //图片服务器端口
var   m_strRootPath;  //图片服务器根路径

// 信息统计服务器的属性
var   m_strSIP;        //统计服务器IP
var   m_strSPort;      //统计服务器端口

var m_nDate = 0;        //当前日期
var m_nPicNum = 0;      //当前日期处理的图片数量
var m_nPicBytes = 0;    //当前日期处理的图片大小
var m_nRefNum = 0;      //当前日期拒绝的图片数量
var m_nRefBytes = 0;    //当前日期拒绝的图片大小

module.exports = {
    get_num : m_nGetNum,
    get_success : m_nGetSucess,
    post_num : m_nPostNum,
    post_success : m_nPostSucess,
    saving_num : m_nPicSavNum,
    save_max : m_nPicSavMax,
    last_post : m_nLastPicPostTime,
    last_save : m_nLastPicSaveTime,
    free_space : m_nFreeBytes,
    total_space : m_nTotalBytes,
    server_ip : m_strIP,
    server_port : m_strPort,
    server_home : m_strRootPath,
    center_ip : m_strSIP,
    center_port : m_strSPort
};

module.exports.add_pic = function (bytes) {
    var today = moment().format('YYYYMMDD');
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
    var today = moment().format('YYYYMMDD');
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
        o.total_space = result.total;
        o.free_space = result.free;
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
        save_max : o.save_max,
        last_post : o.last_post,
        last_save : o.last_save,
        free_space : o.free_space,
        total_space : o.total_space,
    }
    var content = qs.stringify(data);  
    
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

    var o = this;
    diskspace.check(disk_path, function (err, result) {
        o.total_space = result.total;
        o.free_space = result.free;
    });

    //上传状态定时器
    setInterval(upstate, 60000, this);
};