var path = require("path");
var fs = require("fs");
var moment = require('moment');
var log = require('./log');
var state = require('./state');

var m_picBuff = [];        //图片缓存
var m_nPicSavMax = 50;     //同时写入的最大图片数
var m_nPibBuffNum = 5000;  //允许缓存的最大图片数
var m_nSavingNum = 0;      //正在执行的图片保存任务数
var m_lastSaveTime = 0;    //最后一次保存图片的时间


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
function savePic (task) {
    //正在保存的图片数达到最大，将图片内容缓存
    if(m_nSavingNum >= m_nPicSavMax) {
        //console.log('push pic data to buff %s',picPath);
        console.log("pic buff num is %d; saving num is %d", m_picBuff.length, m_nSavingNum);
        m_picBuff.push(task);
        return;
    }

    //保存图片
    m_nSavingNum++;
    m_lastSaveTime = moment().format('HH:mm:ss');

    //console.log('write pic to disk %s',picPath);
    var fd = fs.writeFile(task.path, task.data, function (err) {
        if (err) {
            log.error('文件写入失败',err.message);
            save_pic(task);
            return;
        }

        m_nSavingNum--;               //正在保存任务数
        state.add_pic(task.data.length);  //成功保存的图片大小

        //console.log('write pic to disk ok %s',picPath);
        //将缓存中的图片写入磁盘中
        if(m_picBuff.length > 0 && m_nSavingNum < m_nPicSavMax) {
            var re_task = m_picBuff[0];
            m_picBuff.splice(0,1);
            //console.log('get a pic from buff %s',task.path);
            savePic(re_task);
        }
    });
}

module.exports.save_pic = savePic;

//检查能否处理上传图片请求
module.exports.add_state = function (err) {
    //未处理完成的任务数
    if(m_picBuff.length >= m_nPibBuffNum && m_nSavingNum >= m_nPicSavMax) {
        log.warn("pic buff num is %d; saving num is %d", m_picBuff.length, m_nSavingNum);
        err = "saving file is max";
        return false;
    }
    return true;
};

module.exports.get_state = function () {
    return {
        saving_num : m_nSavingNum,
        buff_len   : m_picBuff.length,
        last_save  : m_lastSaveTime
    };
};

module.exports.finish_all_buff = function () {
    console.log('saving:%d, buff:%d', m_nSavingNum, m_picBuff.length);

    if(m_picBuff.length == 0 && m_nSavingNum == 0)
        return true;
    
    if(m_picBuff.length > 0 && m_nSavingNum < m_nPicSavMax-10) {
        var re_task = m_picBuff[0];
            m_picBuff.splice(0,1);
            //console.log('get a pic from buff %s',task.path);
            savePic(re_task);
    }
};

console.log('run filemgr.js');