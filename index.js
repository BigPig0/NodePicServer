var express = require('express');
var bp      = require('body-parser');
var fs      = require("fs");
var path    = require("path");
var md5tool =require("md5");
var qs      = require('querystring');
var os      = require('os');
var moment  = require('moment');

var log      = require('./log');
var filemgr  = require('./filemgr');
var diskinfo = require('./disk');
var state    = require('./state');
var pro      = require('./process');

//读取命令行参数,加载配置文件
var conf_file = process.argv[2];
if(conf_file == null)
  conf_file = 'config';
var config = require('./'+conf_file);

//加载日志模块
var logPath = './logs/'+conf_file;
filemgr.mkdirsSync(logPath);
log.setPath(logPath);

//加载磁盘信息统计模块
diskinfo.set_disk_path(config.rootPath);

//加载状态统计模块
state.set_server_info('-',config.port);
if(config.centerIP != null) {
  state.run(config.centerIP, config.centerPort);
}

//启动http服务器
var app = express();

//app.use(log4js.connectLogger(logger, {level:log4js.levels.INFO}));
app.use(bp.raw());
app.use(bp.json());
app.use(bp.urlencoded({extended:false}));

/** 图片上传请求 */
app.post('/imageServer/image', function(req, res) {
  //log.info(req.originalUrl);
  state.add_post();

  //检查能否保存图片
  if(pro.is_stop()) {
    res.status(400).send(err);
    var len = req.headers["content-length"];
    if(len) state.add_refuse(Number(len));
    log.warn('不能保存图片[服务器已关闭]');
    return;
  }
  var err;
  if(!diskinfo.add_state(err) || !filemgr.add_state(err)) {
    res.status(400).send(err);
    var len = req.headers["content-length"];
    if(len) state.add_refuse(Number(len));
    log.warn('不能保存图片['+err+']');
    return;
  }

  // 请求里面的原始数据
  var reqData = [];
  var size = 0;
  req.on('data', function (data) {
    reqData.push(data);
    size += data.length;
  });
  req.on('end', function () {
    var picData = Buffer.concat(reqData, size);
    //保存图片内容
    var name = req.query.name;
    var type = req.query.type;
    var md5  = md5tool(name);
    var today = moment();
    var ym = today.format('YYYYMM');
    var ymd = today.format('YYYYMMDD');
    var type_folder = type=='1'?'violation':'record';
    var path = config.rootPath + '\\images\\' + type_folder + '\\' + ym + '\\' + ymd + '\\';
    for (var m=0; m<5; ++m)
    {
      path = path + md5[m] + "\\";
    }
  
    var suffix = name.split(".")[1];
    var file_name = type_folder + "_" + ymd + md5 + '.' + suffix;
    res.send(file_name);       //应答返回文件名称
    state.add_post_ok();       //上传成功数
  
    filemgr.mkdirsSync(path);
    path = path + file_name;
    //log.info("save file %s", path);
    var task = { path : path, data : picData };
    filemgr.save_pic(task);
  });
});

/** 图片访问请求 */
app.get('/imageServer/image', function (req, res) {
   //log.info(req.originalUrl);
   state.add_get();
   var name = req.query.name;
   if(!name) {
     res.status(400).send("not found");
     log.error('错误的图片名称 %s',req.originalUrl)
   }
   var twostr = name.split('_');
   if(twostr.length != 2 || twostr[1].length < 13) {
     res.status(400).send("not found");
     log.warn('错误的图片名称 %s',req.originalUrl);
     return;
   }

   var szType = twostr[0];
   var szYearMonth = twostr[1].slice(0,6);
   var szDay = twostr[1].slice(6,8);
   var szMD5 = twostr[1].slice(8);
   var strPicPath = config.rootPath + "/images/" + szType + "/" + szYearMonth + "/" + szYearMonth + szDay + "/";
   for (var m=0; m<5; ++m)
    {
      strPicPath = strPicPath + szMD5[m] + "/";
    }
    strPicPath += req.query.name;
   //log.info(strPicPath);
   if (fs.existsSync(strPicPath)) {
      //res.header('Cache-Control','no-store');
      res.sendFile(strPicPath);
      state.add_get_ok();
   } else {
      res.status(400).send("not found");
      log.error('图片不存在 %s',req.originalUrl);
   }
});


//图片服务器中心统计数据
var pic_center_data = {};

/** 图片服务器状态提交 */
app.post('/imageCenter/update',function (req, res) {
  //log.info("new request: %s",req.originalUrl);
  var ip_array = req.connection.remoteAddress.split(':');
  var ip = req.connection.remoteAddress;
  if(ip_array.length > 0)
    ip = ip_array[ip_array.length-1];

  pic_center_data[ip + ":" + req.body.server_port] = req.body;
  pic_center_data[ip + ":" + req.body.server_port].server_ip = ip;
  res.send('update ok');

});

/** 图片服务器状态获取 */
app.get('/imageCenter/display',function (req, res) {
    log.info("%s",req.originalUrl);
    var st = { root : []};
    for(serip in pic_center_data) {
      st.root.push(pic_center_data[serip]);
    }
    var data = JSON.stringify(st);
    res.header("Access-Control-Allow-Origin", "*");
    res.status(200).send(data);
});
 
var server = app.listen(config.port, function () {
 
  var host = server.address().address;
  var port = server.address().port;
  state.server_ip = host;
  state.server_port = port;
 
  console.log("应用实例，访问地址为 http://%s:%s", host, port)
 
});
server.setTimeout(0);

console.log('run index.js');