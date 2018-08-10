var http = require('http');
var qs = require('querystring');
var moment = require('moment');
var fs = require("fs");
var log = require('./log');
var filemgr = require('./filemgr');
var diskinfo = require('./disk');

// 当天信息
var m_nDate = 0;         //当前日期
var m_nRefNum = 0;      //当前日期拒绝的图片数量
var m_nRefBytes = 0;    //当前日期拒绝的图片大小

//图片服务器中心
var m_centerIP = "-";
var m_centerPort = "-";


module.exports = {
    //访问图片统计
    get_num : 0,        //访问图片的请求数
    get_success : 0,    //成功访问数

    //上传图片统计
    post_num : 0,       //上传图片请求数
    post_success : 0,   //上传成功数，不一定保存成功
    last_post : 0,      //最后一次收到图片的时间

    // 服务器属性
    server_ip : '-',    //图片服务器IP,不一定跟配置中一样
    server_port : '-',  //图片服务器端口
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
    //存储盘空间大小
    var diskstate = diskinfo.get_disk_info();
    //文件写入状态
    var filestate = filemgr.get_state();

    //发送的数据
    var data = {
        server_ip : o.server_ip,
        server_port : o.server_port,
        get_num : o.get_num,
        get_success : o.get_success,
        post_num : o.post_num,
        post_success : o.post_success,
        saving_num : ''+filestate.saving_num+'/'+filestate.buff_len,
        last_post : o.last_post,
        last_save : filestate.last_save,
        date : m_nDate,
        pic_num : filestate.pic_num,
        pic_bytes: filestate.pic_bytes,
        ref_num : m_nRefNum,
        ref_bytes : m_nRefBytes,
        free_space : diskstate.free_bytes,
        total_space : diskstate.total_bytes,
    }
    var content = qs.stringify(data);  
    console.log(data);
    
    var options = {  
        hostname: m_centerIP,  
        port: m_centerPort,  
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

function update_thread(o) {
    setImmediate(upstate, o);
}

module.exports.run = function (ip,port) {
    m_centerIP = ip;
    m_centerPort = port;
    //上传状态定时器
    setInterval(update_thread, 60000, this);
};

console.log('run state.js');