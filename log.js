var log4js = require('log4js');

//日志对象
var logger;
var logerror;
var is_init = false;

//日志模块
function init(logPath) {
    var infologPath = logPath + '/log.txt';
    var errlogPath = logPath + '/err';
    log4js.configure({
    appenders: {
        console : {          //控制台输出
        type: 'console' 
        }, 
        infofile :{          //文件输出
        type: 'file',
        filename: infologPath, 
        maxLogSize: 1024*1024*10,
        backups:100
        },
        errfile : {          //错误信息文件输出
        type: 'dateFile',
        filename: errlogPath,
        alwaysIncludePattern: true,
        pattern: '-yyyy-MM-dd.txt',
        backups:10
        }
    },
    categories: {
        default: { appenders: ['infofile'], level: 'info' },
        errlog: { appenders: ['errfile'], level: 'error' }
    },
    replaceConsole: true
    });
    logger = log4js.getLogger();
    logerror = log4js.getLogger('errlog');
    is_init = true;
}

module.exports.setPath = (logPath)=> {
    init(logPath);
}

module.exports.debug = (message, ...args)=> {
    if(!is_init) return;
    logger.debug(message, args);
}

module.exports.info = (message, ...args)=> {
    if(!is_init) return;
    logger.info(message, args);
}

module.exports.warn = (message, ...args)=> {
    if(!is_init) return;
    console.log(message, args);
    logger.warn(message, args);
}

module.exports.error = (message, ...args)=> {
    if(!is_init) return;
    console.log(message, args);
    logger.error(message, args);
    logerror.error(message, args);
}

console.log('run log.js');