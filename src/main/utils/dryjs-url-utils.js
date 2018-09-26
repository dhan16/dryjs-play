const DRYJS_URL_UTILS = {
    getParameterByName: function (name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    },

    getParameterByNameFromUrl: function (name, defaultValue) {
        let value = this.getParameterByName(name);
        if (!value) value = defaultValue;
        return value;
    }
};