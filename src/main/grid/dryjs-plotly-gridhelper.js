// <script src="../lib/dryjs/dryjs-grids.js"></script>

var DRYJS_PLOTLYGRIDHELPER = {
    drawGrid: function (grid_divid, gridfile, colorfile, has_timepoints, options) {
        return new DRYJS_GRID.GridControl(gridfile, colorfile, has_timepoints, options, g => this.drawPlotly(grid_divid, g));
    },

    opacity: 1,
    transitionOptions: { duration: 200,
        // easing: 'cubic-in-out',
    },
    frameOptions: {duration: 1000, redraw: false},

    drawPlotly: function (divid, grid) {
        // make data
        let plotlyData = [
            {
                type: 'mesh3d',
                opacity: this.opacity,
                x: grid.vertices.map(v => v.x),
                y: grid.vertices.map(v => v.y),
                z: grid.vertices.map(v => v.z),
                i: grid.surfaceFaces.map(f => f.a),
                j: grid.surfaceFaces.map(f => f.b),
                k: grid.surfaceFaces.map(f => f.c),
                facecolor: grid.surfaceFaces.map(f => grid.getFaceColor(f, 0).getHex()),
            }
        ];

        DRYJS_LOGGER.debug(plotlyData);

        const colorTimes = grid.timepoints;
        // make frames
        let plotlyFrames = [];
        let sliderSteps = [];
        for (let c = 0; c < colorTimes.length; c++) {
            const colorTime = colorTimes[c];
            let data = [{
                facecolor: grid.surfaceFaces.map(f => grid.getFaceColor(f, c).getHex()),
            }];
            const frame = {'data': data, 'name': colorTime};
            plotlyFrames.push(frame);

            sliderSteps.push({
                method: 'animate',
                label: colorTime,
                args: [[colorTime], {
                    mode: 'immediate',
                    transition: this.transitionOptions,
                    frame: this.frameOptions,
                }]
            });
        }

        var buttons = null;
        var sliders = null;
        if(colorTimes.length > 1) {
            buttons = [
                {
                    label: 'Play',
                    method: 'animate',
                    'args': [null, {
                        fromcurrent: true,
                        transition: this.transitionOptions,
                        frame: this.frameOptions,
                    }],
                },
                {
                    label: 'Pause',
                    method: 'animate',
                    args: [[null], {
                        mode: 'immediate',
                        transition: {duration: 0},
                        frame: {duration: 0, redraw: false},
                    }]
                },
            ];
            sliders = [{
                pad: {l: 130, t: 5},
                currentvalue: {
                    visible: true,
                    prefix: '',
                    xanchor: 'right',
                    font: {size: 5, color: '#666'}
                },
                steps: sliderSteps
            }];
        }

        let plotlyLayout = {
            xaxis: {fixedrange: true},
            yaxis: {fixedrange: true},
            zaxis: {fixedrange: true},
            autosize: false,
            width: 1200,
            height: 700,
            margin: {
                l: 10, b: 10, r: 10, t: 1, pad: 1.
            },
            updatemenus: [{
                x: 0,
                y: 0,
                yanchor: 'top',
                xanchor: 'left',
                showactive: false,
                direction: 'left',
                type: 'buttons',
                pad: {t: 20, r: 10},
                buttons: buttons,
            }],
            sliders: sliders,
        };

        let plotlyOptions = {
            displaylogo: false,
        };

        console.log("Calling Plotly.newPlot");
        Plotly.newPlot(divid, plotlyData, plotlyLayout, plotlyOptions)
            .then(function () {
                console.log("addFrames:" + plotlyFrames.length);
                Plotly.addFrames(divid, plotlyFrames);
            });
        console.log("Done");
    }
};
