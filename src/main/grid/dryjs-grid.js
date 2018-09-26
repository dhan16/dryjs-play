// <script src="../external/three-r87.min.js"></script>
// <script src="../external/d3.v4.min"></script>

var DRYJS_GRID = {
    GridBlockVertexOrder: {
        i: [7, 0, 0, 2, 4, 6, 6, 1, 5, 0, 6, 3],
        j: [3, 4, 1, 3, 5, 7, 2, 5, 4, 1, 7, 2],
        k: [0, 7, 2, 0, 6, 4, 1, 6, 0, 5, 3, 6],
    },

    Vector3: function(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.id = x + ":" + y + ":" + z;
    },

    Grid: function(vertices, faces) {
        this.vertices = vertices; // array of {x, y, z}
        this.faces = faces; // array of Three.Face3
        this.numGridBlocks = this.faces.length / 12; // 12 faces per gridBlock
        this.surfaceFaces = DRYJS_GRID_UTILS.findSurfaceFaces(vertices, faces); // array of Three.Face3
        this.defaultColor = new THREE.Color();

        this.getFaceColor = function(face, timeindex) {
            if(face.colors)
                return face.colors[timeindex];
            else
                return this.defaultColor;
        };

        DRYJS_LOGGER.info({
            vertices: vertices.length,
            faces: faces.length,
            numGridBlocks: this.numGridBlocks,
            surfaceFaces: this.surfaceFaces.length,
        });

        this.setColors = function(color_csv, has_timepoints) {
            DRYJS_LOGGER.info( "setColors:START");

            if(has_timepoints) {
                this.timepoints = color_csv[0];
                color_csv = color_csv.slice(1)
            } else {
                this.timepoints = [ "Static"];
            }

            DRYJS_LOGGER.info("setColors::" + color_csv.length  + " colors and " +  this.timepoints.length + " timepoints:" + this.timepoints);

            const min = d3.min(color_csv, function(d) { return d3.min(d3.values(d).map(v => parseFloat(v))); });
            const max = d3.max(color_csv, function(d) { return d3.max(d3.values(d).map(v => parseFloat(v))); });
            const mid = (parseFloat(min)+parseFloat(max))/2;
            const colorScale = d3.scaleLinear()
                .domain([min, mid, max])
                .range(["red", "green", "blue"]);

            // add colors to surfaceFaces
            const num = Math.min(color_csv.length, this.numGridBlocks);
            DRYJS_LOGGER.info("min/mid/max/numGridBlocks/numColoredBlocks::" + [min, mid, max, this.numGridBlocks, num]);
            for (let cnt = 0; cnt < num; cnt++) {
                const colorRow = color_csv[cnt];
                const colors = colorRow.map(c => new THREE.Color(colorScale(c)));
                // all 12 surfaceFaces of the gridblock have the same color
                const firstIndex = cnt*12;
                for (let ii = 0; ii < 12; ii++) {
                    let face3 = this.faces[firstIndex + ii];
                    face3.color.copy(colors[0]);
                    face3.colors = colors;
                }
            }

            DRYJS_LOGGER.info( "setColors:DONE");
        };
    },

    // grid_csvfile has header x,y,z
    // every 8 vertices is a gridBlock. Faces are drawn from these according to GridBlockVertexOrder
    // color_csvfile has header time0, time1, ...
    // there is a color for every gridBlock
    GridControl: function(grid_filename, color_filename, has_timepoints, options, drawFunc) {
        DRYJS_LOGGER.info({
            method: "GridControl",
            grid_filename: grid_filename,
            color_filename: color_filename,
            options: options,
        });

        const msg_div = document.getElementById(options.msg_divid);

        this.grid = null; // of type DRYJS_GRID.Grid
        this.files = new Map();
        this.drawFunc = drawFunc;
        this.msg_div = msg_div;

        function getCsv(fileurl, callback) {
            return getFile(fileurl, function(xhr) { return d3.csvParse(xhr.responseText); }, callback);

        }

        function getCsvRows(fileurl, callback) {
            return getFile(fileurl, function(xhr) { return d3.csvParseRows(xhr.responseText); }, callback);
        }

        function getFile(fileurl, file_parser, callback) {
            DRYJS_LOGGER.info("Getting " + fileurl);
            return d3.request(fileurl)
                .mimeType("text/csv")
                .response(file_parser)
                .header('Authorization', 'JWT ' + options.jwtToken)
                .get(function(error, data) {
                    DRYJS_LOGGER.info("Got " + fileurl);
                    callback(error, data);
                });
        }

        const me = this;
        DRYJS_LOGGER.info("Getting grid data...", msg_div);
        d3.queue()
            .defer(getCsv, grid_filename)
            .defer(getCsvRows, color_filename)
            .await(function(error, grid_csv, color_csv) {
                if (error) {
                    DRYJS_LOGGER.error(error, msg_div);
                }
                else {
                    DRYJS_LOGGER.info("Got:" + grid_filename + "and" + color_filename);

                    me.files.set(color_filename, color_csv);
                    me.grid = DRYJS_GRID_UTILS.createGrid(grid_csv, options);
                    me.setColor(color_filename, has_timepoints);
                }
            });

        this.setColor = function(color_filename, has_timepoints) {
            DRYJS_LOGGER.info("setColor:" + color_filename);

            const colorCsv = this.files.get(color_filename);
            if(!colorCsv) {
                d3.queue()
                    .defer(getCsvRows, color_filename)
                    .await(function(error, csv) {
                        if (error) {
                            DRYJS_LOGGER.error(error, msg_div);
                        }
                        else {
                            DRYJS_LOGGER.info("Got:" + color_filename);
                            me.files.set(color_filename, csv);
                            me.setColor(color_filename, has_timepoints);
                        }
                    });
                return;
            }

            this.grid.setColors(colorCsv, has_timepoints);
            DRYJS_LOGGER.info("Drawing grid...", this.msg_div);
            this.drawFunc.apply(null, [this.grid]);
            DRYJS_LOGGER.info("", this.msg_div);
        };
    },
};

var DRYJS_GRID_UTILS = {
    // assume each block of 8 vertices is a cube in order GridBlockVertexOrder
    createGrid: function(vertices, options) {
        DRYJS_LOGGER.info("createGrid:START");
        DRYJS_LOGGER.info({vertices: vertices.length, options:options});

        if(options.fixNaNs)
            vertices = DRYJS_GRID_UTILS.fixNaNs(vertices);

        // plotly.newPlot is faster with lesser vertices (2/3 secs for 130K vertices vs 5/6 secs for 900K)
        const uniqueVertices = DRYJS_GRID_UTILS.createUniqueVertices(vertices);
        const grid_vertices = uniqueVertices.vertices;
        const indexToNewIndexMap = uniqueVertices.indexToNewIndexMap;

        // make faces
        const i0 = DRYJS_GRID.GridBlockVertexOrder.i;
        const j0 = DRYJS_GRID.GridBlockVertexOrder.j;
        const k0 = DRYJS_GRID.GridBlockVertexOrder.k;
        const Ng = vertices.length / 8; // 8 vertices per cube
        let faces = [];
        for (let cnt = 0; cnt < Ng; cnt++) {
            const inc = 8 * cnt; // 8 vertices per cube
            for ( let ii = 0; ii < 12; ii++) { // 12 faces per cube
                const face = new THREE.Face3(
                    indexToNewIndexMap.get(i0[ii] + inc),
                    indexToNewIndexMap.get(j0[ii] + inc),
                    indexToNewIndexMap.get(k0[ii] + inc));
                faces.push(face);
            }
        }
        DRYJS_LOGGER.info({faces: faces.length});

        const grid = new DRYJS_GRID.Grid(grid_vertices, faces);
        DRYJS_LOGGER.info( "createGrid:DONE");
        return grid;
    },

    createUniqueVertices: function(vertices) {
        DRYJS_LOGGER.info( "createUniqueVertices:START");

        const idToNewIndexMap = new Map();
        const indexToNewIndexMap = new Map();
        const grid_vertices = [];
        for (let i = 0; i < vertices.length; i++) {
            const vi = vertices[i];
            const v = new DRYJS_GRID.Vector3(vi.x, vi.y, vi.z);
            if(!idToNewIndexMap.has(v.id)) {
                grid_vertices.push(v);
                idToNewIndexMap.set(v.id, grid_vertices.length - 1);
            }

            indexToNewIndexMap.set(i, idToNewIndexMap.get(v.id));
        }

        DRYJS_LOGGER.info({grid_vertices: grid_vertices.length});
        DRYJS_LOGGER.info("createUniqueVertices:DONE");
        return {
            vertices: grid_vertices,
            indexToNewIndexMap: indexToNewIndexMap,
        };
    },

    findSurfaceFaces: function(vertices, faces) {
        DRYJS_LOGGER.info( "findSurfaceFaces:START");

        function faceid(f) {
            return vertices[f.a].id + ":" + vertices[f.b].id + ":" + vertices[f.c].id;
        }
        const idToFaceMap = new Map();
        const faceCounts = new Map();
        for (let face of faces) {
            const fid = faceid(face);
            idToFaceMap.set(fid, face);
            faceCounts.set(fid, (faceCounts.get(fid) || 0 ) + 1);
        }

        let surfaceFaces = [];
        faceCounts.forEach((c,fid) => {
            if(c===1) surfaceFaces.push(idToFaceMap.get(fid));
        });

        DRYJS_LOGGER.info( "findSurfaceFaces:DONE");
        return surfaceFaces;
    },

    fixNaNs: function(vertices_csv) {
        DRYJS_LOGGER.info( "fixNaNs:START");

        const vertices = [];
        vertices_csv.forEach(function (d,i) {
            let e = {
                x: parseFloat(d.x),
                y: parseFloat(d.y),
                z: parseFloat(d.z),
            };
            if(!Number.isNaN(e.x) && !Number.isNaN(e.y) && !Number.isNaN(e.z))
                vertices[i] = {
                    x: e.x,
                    y: e.y,
                    z: e.z,
                };
            else
                vertices[i] = vertices[i-1];
        });

        DRYJS_LOGGER.info( "fixNaNs:DONE");
        return vertices;
    },
};