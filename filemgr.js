var path = require("path");
var fs = require("fs");
var moment = require('moment');
var log = require('./log');
var state = require('./state');
var List = require('./list').List;

var m_picBuff = new Map;        //等待写入的图片
var m_picBuffKey = new List();  //等待写入的图片名称
var m_picWritingBuff = new Map; //正在写的图片
var m_picWriteBuff = new Map;   //已保存图片
var m_picWriteKey = new List(); //已保存图片的名称
var m_picReadBuff = new Map;    //已读取图片缓存
var m_picReadKey = new List();  //已读取图片缓存的名称

var m_nPicSavMax = 50;     //同时写入的最大图片数
var m_nPicBuffNum = 5000;  //允许缓存的最大图片数
var m_nPicWriteBuffNum = 10000; //写缓存最大图片数
var m_nPicReadBuffNum = 10000; //读缓存最大图片数

var m_nSavingNum = 0;      //正在执行的图片保存任务数
var m_lastSaveTime = 0;    //最后一次保存图片的时间

var m_rootPath;            //图片保存位置

//测试
var t_picBuff_hit = 0;
var t_writingBuff_hit = 0;
var t_writeBuff_hit = 0;
var t_readBuff_hit = 0;
var t_disk_hit = 0;

module.exports.SetRoot = function(path) {
    m_rootPath = path;
}

function mkdirs_Sync(dirname) {
    //console.log(dirname);  
    if (fs.existsSync(dirname)) {  
        return true;  
    } else {  
        if (mkdirs_Sync(path.dirname(dirname))) {  
            fs.mkdirSync(dirname);  
            return true;  
        }  
    }  
}

//递归创建目录 同步方法 
module.exports.mkdirsSync = mkdirs_Sync;

//保存文件到磁盘
function savePic (file_name, task) {
    //正在保存的图片数达到最大，将图片内容缓存
    if(m_nSavingNum >= m_nPicSavMax) {
        //console.log('push pic data to buff %s',picPath);
        log.warn("pic buff num is %d; saving num is %d", m_picBuffKey.length, m_nSavingNum);
        m_picBuffKey.push(file_name);
        m_picBuff.set(file_name, task);
        return;
    }

    //准备写入的图片文件放到写队列中
    m_picWritingBuff.set(file_name, task);
    m_nSavingNum++;

    //保存图片
    m_lastSaveTime = moment().format('YYYY-MM-DD HH:mm:ss');
    //console.log('write pic to disk %s',task.path);
    fs.writeFile(task.path, task.data, function (err) {
        //从写队列中取出完成的图片
        m_picWritingBuff.delete(file_name);
        m_nSavingNum--;    //正在保存任务数

        //文件写入失败
        if (err) {
            log.error('文件写入失败',err.message);
            savePic(file_name, task);
            return;
        }

        //文件写入成功
        //console.log('write pic to disk ok %s',task.path);
        state.add_pic(task.data.length);  //成功保存的图片大小
        m_picWriteKey.push(file_name);
        m_picWriteBuff.set(file_name, task);
        while(m_picWriteKey.length > m_nPicWriteBuffNum) {
            let firstName = m_picWriteKey.front();
            m_picWriteKey.shift();
            m_picWriteBuff.delete(firstName);
        } 

        //将缓存中的图片写入磁盘中
        if(m_picBuffKey.length > 0 && m_nSavingNum < m_nPicSavMax) {
            let re_name = m_picBuffKey.front();
            m_picBuffKey.shift();
            if(m_picBuff.has(re_name)) {
                var re_task = m_picBuff.get(re_name);
                m_picBuff.delete(re_name);
                //console.log('get a pic from buff %s',task.path);
                savePic(re_name, re_task);
            }
        }
    });
}

module.exports.save_pic = savePic;

//根据图片名称获取文件内容
function getpic(file_name, sendCB) {
    if(m_picBuff.has(file_name)) {
        let task = m_picBuff.get(file_name);
        if(task) {
            log.info('m_picBuff hit');
            t_picBuff_hit++;
            sendCB(true, task.data);
            return;
        }
    }
    if(m_picWritingBuff.has(file_name)) {
        let task = m_picWritingBuff.get(file_name);
        if(task) {
            log.info('m_picWritingBuff hit');
            t_writingBuff_hit++;
            sendCB(true, task.data);
            return;
        }
    }
    if(m_picWriteBuff.has(file_name)) {
        let task = m_picWriteBuff.get(file_name);
        if(task) {
            log.info('m_picWriteBuff hit');
            t_writeBuff_hit++;
            sendCB(true, task.data);
            return;
        }
    }
    if(m_picReadBuff.has(file_name)) {
        let task = m_picReadBuff.get(file_name);
        if(task) {
            log.info('m_picReadBuff hit');
            t_readBuff_hit++
            sendCB(true, task.data);
            return;
        }
    }
    //不在缓存中，从磁盘读取文件
    var twostr = file_name.split('_');
    if(twostr.length != 2 || twostr[1].length < 13) {
        log.warn('错误的图片名称 %s',file_name);
        sendCB(false, 'error pic name');
        return;
    }

    var szType = twostr[0];
    var szYearMonth = twostr[1].slice(0,6);
    var szDay = twostr[1].slice(6,8);
    var szMD5 = twostr[1].slice(8);
    var strPicPath = m_rootPath + "/images/" + szType + "/" + szYearMonth + "/" + szYearMonth + szDay + "/";
    for (var m=0; m<5; ++m)
    {
        strPicPath = strPicPath + szMD5[m] + "/";
    }
    strPicPath += file_name;
    //log.info(strPicPath);
    if (fs.existsSync(strPicPath)) {
        try{
            fs.readFile(strPicPath, function(err, data){
                if(err) {
                    log.error('读取图片错误 %s',err.message);
                    sendCB(false, err.message);
                } else {
                    m_picReadKey.push(file_name);
                    let task = { path : strPicPath, data : data };
                    m_picReadBuff.set(file_name, task);
                    while(m_picReadKey.length > m_nPicReadBuffNum) {
                        let firstName = m_picReadKey.front();
                        m_picReadKey.shift();
                        m_picReadBuff.delete(firstName);
                    }
                    t_disk_hit++;
                    sendCB(true, data);
                }
            });
        } catch (e) {
            log.error('读取图片错误捕获');
            sendCB(false, 'err when read pic');
        }
        return;
    } else {
        //res.status(400).send("not found");
        sendCB(false, "not found");
        log.error('图片不存在 %s',file_name);
    }
}
module.exports.get_pic = getpic;

//检查能否处理上传图片请求
module.exports.add_state = function (err) {
    //未处理完成的任务数
    if(m_picBuffKey.length >= m_nPicBuffNum && m_nSavingNum >= m_nPicSavMax) {
        log.warn("pic buff num is %d; saving num is %d", m_picBuffKey.length, m_nSavingNum);
        err = "saving file is max";
        return false;
    }
    return true;
};

module.exports.get_state = function () {
    return {
        saving_num : m_nSavingNum,
        buff_len   : m_picBuffKey.length,
        last_save  : m_lastSaveTime,
        pic_buff_hit : t_picBuff_hit,
        wi_buff_hit : t_writingBuff_hit,
        w_buff_hit : t_writeBuff_hit,
        r_buff_hit : t_readBuff_hit,
        disk_hit   : t_disk_hit,
		w_buff_len : m_picWriteKey.length,
		r_buff_len : m_picReadKey.length
    };
};

module.exports.finish_all_buff = function () {
    console.log('saving:%d, buff:%d', m_nSavingNum, m_picBuffKey.length);

    if(m_picBuffKey.length == 0 && m_nSavingNum == 0)
        return true;
    
    if(m_picBuffKey.length > 0 && m_nSavingNum < m_nPicSavMax-10) {
        let re_name = m_picBuffKey.front();
        m_picBuffKey.shift();
        if(m_picBuff.has(re_name)) {
            var re_task = m_picBuff.get(re_name);
            m_picBuff.delete(re_name);
            //console.log('get a pic from buff %s',task.path);
            savePic(re_name, re_task);
        }
    }
};

console.log('run filemgr.js');