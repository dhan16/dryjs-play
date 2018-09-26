const DRYJS_LOGGER = {
    isLogDebug: false,

    setDebugMode: function(onOrOff) {
        this.info("Setting isLogDebug to " + onOrOff);
        this.isLogDebug = onOrOff;
    },

    info: function(msg, msg_div) {
        console.log(msg);
        if(msg_div)
            msg_div.innerHTML = msg;
    },

    debug: function(msg, msg_div) {
        if(!this.isLogDebug) return;
        this.info(msg, msg_div);
    },

    error: function(error, msg_div) {
        this.info(error, msg_div);
    },
};