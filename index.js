var express = require('express');
var bodyParser = require('body-parser');
var fs = require("fs");
var path = require("path");
var md5tool=require("md5");
var qs = require('querystring');
var os = require('os');
var moment = require('moment');

//递归创建目录 同步方法  
function mkdirsSync(dirname) {  
  //console.log(dirname);  
  if (fs.existsSync(dirname)) {  
      return true;  
  } else {  
      if (mkdirsSync(path.dirname(dirname))) {  
          fs.mkdirSync(dirname);  
          return true;  
      }  
  }  
}  

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
if(config.centerIP != null)
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
  //console.log("%s,%s,%s",req.originalUrl,req.query.name,req.query.type);
  state.post_num++;
  state.last_post = moment().format('hh:mm:ss');

  //检查能否保存图片
  var err;
  if(!state.add_state(err)) {
    res.status(400).send(err);
    state.add_refuse(req.headers["content-length"]);
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
    var type_folder = type=='1'?'volation':'record';
    var path = config.rootPath + '\\images\\' + type_folder + '\\' + ym + '\\' + ymd + '\\';
    for (var m=0; m<5; ++m)
    {
      path = path + md5[m] + "\\";
    }
  
    var suffix = name.split(".")[1];
    var file_name = type_folder + "_" + ymd + md5 + '.' + suffix;
    res.send(file_name);
  
    state.saving_num++;
    mkdirsSync(path);
    path = path + file_name;
    //console.log("save file %s", path);
    state.last_save = moment().format('hh:mm:ss');
    var fd = fs.writeFile(path, picData, function (err) {
      state.post_success++;
      if (err){
          console.log('文件写入失败',err.message);
      };
      state.saving_num--; //正在保存任务数
      state.add_pic(picData.length);  //成功保存的图片
    });
  });
})

/** 图片访问请求 */
app.get('/imageServer/image', function (req, res) {
   console.log(req.originalUrl);
   state.get_num++;
   //console.log(req.body);
   //var parsename = sscanf(req.query.name, "%s_%6s%2s%5s");
   var twostr = req.query.name.split('_');
   if(twostr.length != 2 || twostr[1].length < 13) {
     res.status(400).send("not found");
     return;
   }

   var szType = twostr[0];
   var szYearMonth = twostr[1].slice(0,6);
   var szDay = twostr[1].slice(6,8);
   var szMD5 = twostr[1].slice(8);
   var strPicPath = config.rootPath + "\\images\\" + szType + "\\" + szYearMonth + "\\" + szYearMonth + szDay + "\\";
   for (var m=0; m<5; ++m)
    {
      strPicPath = strPicPath + szMD5[m] + "\\";
    }
    strPicPath += req.query.name;
   //res.send('Hello World');
   console.log(strPicPath);
   res.sendFile(strPicPath);
   state.get_success++;
})

/** 图片服务器状态提交 */
app.post('/imageCenter/update',function (req, res) {
  console.log("new request: %s",req.originalUrl);
  //console.log(req.body);
  pic_center_data[req.connection.remoteAddress] = req.body;
  pic_center_data[req.connection.remoteAddress].server_ip = req.connection.remoteAddress;
  //console.log(pic_center_data);
  res.send('update ok');

})

/** 图片服务器状态获取 */
app.get('/imageCenter/display',function (req, res) {
    console.log("%s",req.originalUrl);
    var st = { root : []};
    for(serip in pic_center_data) {
      st.root.push(pic_center_data[serip]);
    }
    var data = JSON.stringify(st);
    //console.log(data);
    res.header("Access-Control-Allow-Origin", "*");
    res.status(200).send(data);
})
 
var server = app.listen(config.port, function () {
 
  var host = server.address().address;
  var port = server.address().port;
  state.server_ip = host;
  state.server_port = port;
 
  console.log("应用实例，访问地址为 http://%s:%s", host, port)
 
})