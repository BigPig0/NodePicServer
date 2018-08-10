var log = require('./log');
var filrmgr = require('./filemgr');
var isStop = false;

process.on('exit', function(){
    log.error('process exit.');
});

process.on('SIGINT', function() {
    console.log('Got SIGINT.  Press Control-D/Control-C to exit.');
    log.info('Got SIGINT.  Press Control-D/Control-C to exit.');
    taskStop();
});

process.on('uncaughtException',function(err){
    log.error('uncaughtException-->'+err.stack+'--'+new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString());
    taskStop();
    //process.exit();
});

function checkFinish() {
    if( filrmgr.finish_all_buff() )
        process.exit();
}

function taskStop() {
    isStop = true;
    setInterval(checkFinish, 1000);
}

module.exports.is_stop = function () {
    return isStop;
};

console.log('run process.js');