var http   = require('http');
var qs     = require('querystring');
var moment = require('moment');
var fs     = require("fs");

var log      = require('./log');
var filemgr  = require('./filemgr');
var diskinfo = require('./disk');

// 当天信息
var m_nDate = moment().format('YYYY-MM-DD');    //当前日期
var m_nGetNum = 0;      //访问图片的请求数
var m_nGetSuccess = 0;  //成功访问数
var m_nPostNum = 0;     //上传图片请求数
var m_nPostSuccess = 0; //正确的上传请求数，统计于开始写文件之前
var m_lastPostTime = 0; //最后一次收到图片的时间
var m_nPicNum = 0;      //当前日期处理的图片数量
var m_nPicBytes = 0;    //当前日期处理的图片大小
var m_nRefNum = 0;      //当前日期拒绝的图片数量
var m_nRefBytes = 0;    //当前日期拒绝的图片大小

//图片服务器
var m_serverIP = '0.0.0.0';
var m_serverport = 80;
//图片服务器中心
var m_centerIP = "-";
var m_centerPort = "-";

module.exports = {
    //查看图片请求统计
    add_get     : ()=>{ ++m_nGetNum; },
    add_get_ok  : ()=>{ ++m_nGetSuccess; },
    //推送图片请求统计
    add_post    : ()=>{ ++m_nPostNum; m_lastPostTime = moment().format('YYYY-MM-DD HH:mm:ss');},
    add_post_ok : ()=>{ ++m_nPostSuccess; },
    //写入成功的图片统计
    add_pic     : (bytes)=>{++m_nPicNum; m_nPicBytes += bytes; },
    //被拒绝的图片统计
    add_refuse  : (bytes)=>{++m_nRefNum; m_nRefBytes += bytes; },
    //服务的ip、端口信息传递
    set_server_info : (ip, port)=>{
        m_serverIP = ip;
        m_serverport = port;
    }
};

  
//上传状态
function upstate() {
    //新的一天重新统计
    var today = moment().format('YYYY-MM-DD');
    if (m_nDate != today) {
        m_nDate = today;
        m_nGetNum = 0;      //访问图片的请求数
        m_nGetSuccess = 0;  //成功访问数
        m_nPostNum = 0;     //上传图片请求数
        m_nPostSuccess = 0; //正确的上传请求数，统计于开始写文件之前
        m_nPicNum = 0;      //当前日期处理的图片数量
        m_nPicBytes = 0;    //当前日期处理的图片大小
        m_nRefNum = 0;      //当前日期拒绝的图片数量
        m_nRefBytes = 0;    //当前日期拒绝的图片大小
    }

    //存储盘空间大小
    var diskstate = diskinfo.get_disk_info(true);
    //文件保存状态
    var filestate = filemgr.get_state();

    //发送的数据
    var data = {
        server_ip    : m_serverIP,
        server_port  : m_serverport,
        get_num      : m_nGetNum,
        get_success  : m_nGetSuccess,
        post_num     : m_nPostNum,
        post_success : m_nPostSuccess,
        saving_num   : ''+filestate.saving_num+'/'+filestate.buff_len,
        last_post    : m_lastPostTime,
        last_save    : filestate.last_save,
        date         : m_nDate,
        pic_num      : m_nPicNum,
        pic_bytes    : m_nPicBytes,
        ref_num      : m_nRefNum,
        ref_bytes    : m_nRefBytes,
        free_space   : diskstate.free_bytes,
        total_space  : diskstate.total_bytes,
    }
    var content = qs.stringify(data);  
    console.log(data);
    console.log(filestate);
    
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

function update_thread() {
    setImmediate(upstate);
}

module.exports.run = function (ip,port) {
    m_centerIP = ip;
    m_centerPort = port;
    //上传状态定时器
    setInterval(update_thread, 60000);
};

console.log('run state.js');