var diskspace = require('diskspace');
var http = require('http');
var qs = require('querystring');

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
    server_ip : m_strIP,
    server_port : m_strPort,
    server_home : m_strRootPath,
    center_ip : m_strSIP,
    center_port : m_strSPort
};

module.exports.add_pic = function (bytes) {
    var today = new Date;
    var year = today.getFullYear() + 1970;
    var month = today.getMonth() + 1;
    var date = today.getDate();
    var todate = year*10000 + month*100 + date;
    if (m_nDate == todate) {
        ++m_nPicNum;
        m_nPicBytes += bytes;
    } else {
        m_nDate = todate;
        m_nPicNum = 1;
        m_nPicBytes = bytes;
    }
};

module.exports.add_refuse = function (bytes) {
    var today = new Date;
    var year = today.getFullYear() + 1970;
    var month = today.getMonth() + 1;
    var date = today.getDate();
    var todate = year*10000 + month*100 + date;
    if (m_nDate == todate) {
        ++m_nRefNum;
        m_nRefBytes += bytes;
    } else {
        m_nDate = todate;
        m_nRefNum = 1;
        m_nRefBytes = bytes;
    }
};

module.exports.run = function () {
    var disk_path = this.server_home[0];
    console.log('store disk is %c', disk_path);
    setInterval(function() {
        //获取当前磁盘空间
        diskspace.check(disk_path, function (err, result) {
            m_nTotalBytes = result.total;
            m_nFreeBytes = result.free;
        });

        //发送的数据
        var data = new Object();
        data.get_num = m_nGetNum;
        data.get_success = m_nGetSucess;
        data.post_num = m_nPostNum;
        data.post_success = m_nPostSucess;
        data.saving_num = m_nPicSavNum;
        data.save_max = m_nPicSavMax;
        data.last_post = m_nLastPicPostTime;
        data.last_save = m_nLastPicSaveTime; 
        var content = qs.stringify(data);  
          
        var options = {  
            hostname: m_strSIP,  
            port: m_strSPort,  
            path: '/imageCenter/update',  
            method: 'POST',
            headers: {  
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'  
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

    }, 1000);
};