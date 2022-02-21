var express = require('express');
var bp      = require('body-parser');
var fs      = require("fs");
var path    = require("path");
var md5tool = require("md5");
var qs      = require('querystring');
var os      = require('os');
var moment  = require('moment');
var mime    = require("mime")

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
filemgr.SetRoot(config.rootPath);
if(config.saveDuration != null || config.savePath != null) {
  //配置中有清理文件参数，需要启动过期文件清理任务
  filemgr.run(config.saveDuration, config.savePath);
}

//加载状态统计模块
state.set_server_info('-', config.port);
if(config.centerIP != null) {
  state.run(config.centerIP, config.centerPort);
}

//启动http服务器
var app = express();

app.use(log.connectLogger());
app.use(bp.raw());
app.use(bp.json());
app.use(bp.urlencoded({extended:false}));

var _hms = "";
var _index = 0;
/** 图片上传请求 */
app.post('/imageServer/image', function(req, res) {
  //log.info(req.originalUrl);
  state.add_post();

  if(!req.headers["content-length"]){
    log.error("image size is 0");
    res.status(400).send("image size is 0");
    return;
  }

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
    if(size == 0){
      log.error("image size is 0");
      res.status(400).send("image size is 0");
      return;
    }
    //保存图片内容
    var name = req.query.name;
    var type = req.query.type;
    var md5  = md5tool(name);
    var today = moment();
    var ym = today.format('YYYYMM');
    var ymd = today.format('YYYYMMDD');
    var hms = today.format('HHmmss');
    if(_hms != hms) {
      _hms = hms;
      _index = 0;
    }
    var type_folder = type=='1'?'violation':'record';
    var path = config.rootPath + '/images/' + type_folder + '/' + ym + '/' + ymd + '/';
    for (var m=0; m<5; ++m)
    {
      path = path + md5[m] + "/";
    }
  
    var index = name.lastIndexOf(".");
    var suffix = name.substr(index+1);
    var file_name = type_folder + "_" + ymd + md5 +'[' + _hms + '_' + _index + '].' + suffix;
    _index += 1;

    var status = filemgr.get_state();
    res.setHeader('serverBufLen', ''+status.buff_len);
    res.setHeader('freeSpace', '' + diskinfo.get_disk_info(false).free_bytes);
    res.send(file_name);       //应答返回文件名称
    state.add_post_ok();       //上传成功数
  
    filemgr.mkdirsSync(path);
    path = path + file_name;
    log.info("save file %s", path);
    var task = { path : path, data : picData };
    filemgr.save_pic(file_name, task);
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
	 return;
   }
   
   filemgr.get_pic(name, function(find, data){
     if(find) {
       res.setHeader('Content-Type',mime.getType(name));
	   res.setHeader('Access-Control-Allow-Origin','*');
       res.send(data);
       state.add_get_ok();
     } else {
      res.status(400).send(data);
      log.error('图片不存在 %s',req.originalUrl);
     }
   });

});

/** 图片服务器心跳，可用于获取服务器状态 */
app.get('/imageServer/pingpong', function (req, res){
    var status = filemgr.get_state();
    res.setHeader('SerBufLen', '' + status.buff_len);
    res.setHeader('freeSpace', '' + diskinfo.get_disk_info(false).free_bytes);
    res.send('pingpong');
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

/** 图片删除请求 */
app.delete('/imageServer/image', function (req, res) {
  //log.info(req.originalUrl);
  var name = req.query.name;
  if(!name) {
    res.status(400).send("not found");
    log.error('错误的图片名称 %s',req.originalUrl)
    return;
  }
  
  filemgr.del_pic(name, function(find, data){
    res.setHeader('Access-Control-Allow-Origin','*');
    if(find) {
      res.send("OK");
    } else {
      res.status(400).send(data);
      log.error('删除图片错误 %s',req.originalUrl);
    }
  });

});
 
if(config.port != null) {
  // 配置了监听端口，需要启动http服务器
  var server = app.listen(config.port, function () {
    var host = server.address().address;
    var port = server.address().port;
    state.server_ip = host;
    state.server_port = port;
  
    console.log("应用实例，访问地址为 http://%s:%s", host, port)
  });
  server.setTimeout(0);
  server.keepAliveTimeout=0;
}

console.log('run index.js');