var express = require('express');
var bodyParser = require('body-parser');
var fs = require("fs");
var md5tool=require("md5");
var qs = require('querystring');
var os = require('os');

//读取命令行参数,配置文件
var conf_file = process.argv[2];
if(conf_file == null)
  conf_file = 'config';
var config = require('./'+conf_file);

//加载状态统计模块
var state = require('./state');
state.server_port = config.port;
state.server_home = config.rootPath;
state.center_ip = config.centerIP;
state.center_port = config.centerPort;
state.run();

//图片服务器中心统计数据
var pic_center_data = {};

//启动http服务器
var app = express();

app.use(bodyParser.raw());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

/** 图片上传请求 */
app.post('/imageServer/image', function(req, res) {
  console.log("%s,%s,%s",req.originalUrl,req.query.name,req.query.type);
  // 请求里面的原始数据
  var reqData = [];
  var size = 0;
  req.on('data', function (data) {
    console.log('>>>req on');
    reqData.push(data);
    size += data.length;
  });
  req.on('end', function () {
    req.reqData = Buffer.concat(reqData, size);
    //保存图片内容
    var name = req.query.name;
    var type = req.query.type;
    var md5  = md5tool(name);
    var today = new Date;
    var year = today.getFullYear() + 1970;
    var month = today.getMonth() + 1;
    var date = today.getDate();
    var type_folder = type=='1'?'volation':'record';
    var path = config.server_home + '\\images\\' + type_folder + '\\'
       + year + month + '\\'
       + year + month + date + '\\';
    for (var m=0; m<5; ++m)
    {
      path = path + md5[m] + "\\";
    }
  
    var suffix = name.split(".")[1];
    var file_name = type_folder << "_" << year << month << date << md5 << suffix;
    path = path + file_name;
    console.log("save file %s", path);
    res.send(file_name);
  
    var options = { encoding: 'ignored' };
    var fd = fs.writeFile(path, req.reqData, options, function (err,bite,data) {
      if (!err){
          console.log('文件写入成功');
      };
      fs.close(fd,function (err) {
        if (!err){
            console.log('文件已关闭');
        };
      })
    });
  });
})

/** 图片访问请求 */
app.get('/imageServer/image', function (req, res) {
   console.log("%s,%s",req.originalUrl,req.query.name);
   console.log(req.body);
   res.send('Hello World');
})

/** 图片服务器状态提交 */
app.post('/imageCenter/update',function (req, res) {
  console.log("new request: %s",req.originalUrl);
  //console.log(req.body);
  pic_center_data[req.connection.remoteAddress] = req.body;
  pic_center_data[req.connection.remoteAddress].server_ip = req.connection.remoteAddress;
  console.log(pic_center_data);
  res.send('update ok');

})

/** 图片服务器状态获取 */
app.get('/imageCenter/display',function (req, res) {
    console.log("%s",req.originalUrl);
    var data = JSON.stringify(pic_center_data);
    console.log(data);
    res.send(data);
})
 
var server = app.listen(config.port, function () {
 
  var host = server.address().address;
  var port = server.address().port;
  state.server_ip = host;
  state.server_port = port;
 
  console.log("应用实例，访问地址为 http://%s:%s", host, port)
 
})