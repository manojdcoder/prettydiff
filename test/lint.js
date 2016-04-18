/*jslint node:true*/
/*jshint laxbreak: true*/
// The order array determines which tests run in which order (from last to first
// index)
(function taskrunner() {
    "use strict";
    var order      = [
            "lint", //        - run jslint on all unexcluded files in the repo
            "packagejson", // - beautify the package.json file and compare it to itself
            "coreunits", //   - run a variety of files through the application and compare the result to a known good file
            //"diffunits", //   - unit tests for the diff process
            "simulations" //  - simulate a variety of execution steps and options from the command line
        ],
        startTime  = Date.now(),
        fs         = require("fs"),
        path       = require("path"),
        humantime  = function taskrunner_humantime() {
            var minuteString = "",
                hourString   = "",
                secondString = "",
                finalTime    = "",
                finalMem     = "",
                minutes      = 0,
                hours        = 0,
                elapsed      = 0,
                memory       = {},
                prettybytes  = function taskrunner_humantime_prettybytes(an_integer) {
                    //find the string length of input and divide into triplets
                    var length  = an_integer
                            .toString()
                            .length,
                        triples = (function taskrunner_humantime_prettybytes_triples() {
                            if (length < 22) {
                                return Math.floor((length - 1) / 3);
                            }
                            //it seems the maximum supported length of integer is 22
                            return 8;
                        }()),
                        //each triplet is worth an exponent of 1024 (2 ^ 10)
                        power   = (function taskrunner_humantime_prettybytes_power() {
                            var a = triples - 1,
                                b = 1024;
                            if (triples === 0) {
                                return 0;
                            }
                            if (triples === 1) {
                                return 1024;
                            }
                            do {
                                b = b * 1024;
                                a -= 1;
                            } while (a > 0);
                            return b;
                        }()),
                        //kilobytes, megabytes, and so forth...
                        unit    = [
                            "",
                            "KB",
                            "MB",
                            "GB",
                            "TB",
                            "PB",
                            "EB",
                            "ZB",
                            "YB"
                        ],
                        output  = "";

                    if (typeof an_integer !== "number" || isNaN(an_integer) === true || an_integer < 0 || an_integer % 1 > 0) {
                        //input not a positive integer
                        output = "0.00B";
                    } else if (triples === 0) {
                        //input less than 1000
                        output = an_integer + "B";
                    } else {
                        //for input greater than 999
                        length = Math.floor((an_integer / power) * 100) / 100;
                        output = length.toFixed(2) + unit[triples];
                    }
                    return output;
                },
                plural       = function core__proctime_plural(x, y) {
                    var a = "";
                    if (x !== 1) {
                        a = x + y + "s ";
                    } else {
                        a = x + y + " ";
                    }
                    return a;
                },
                minute       = function core__proctime_minute() {
                    minutes      = parseInt((elapsed / 60), 10);
                    minuteString = plural(minutes, " minute");
                    minutes      = elapsed - (minutes * 60);
                    secondString = (minutes === 1)
                        ? " 1 second "
                        : minutes.toFixed(3) + " seconds ";
                };
            memory       = process.memoryUsage();
            finalMem     = prettybytes(memory.rss);

            //last line for additional instructions without bias to the timer
            elapsed      = (Date.now() - startTime) / 1000;
            secondString = elapsed.toFixed(3);
            if (elapsed >= 60 && elapsed < 3600) {
                minute();
            } else if (elapsed >= 3600) {
                hours      = parseInt((elapsed / 3600), 10);
                hourString = hours.toString();
                elapsed    = elapsed - (hours * 3600);
                hourString = plural(hours, " hour");
                minute();
            } else {
                secondString = plural(secondString, " second");
            }
            finalTime = hourString + minuteString + secondString;
            console.log(finalMem + " of memory consumed");
            console.log(finalTime + "total time");
            console.log("");
        },
        prettydiff = require("../prettydiff.js"),
        options    = {},
        errout     = function taskrunner_errout(errtext) {
            console.log("");
            console.error(errtext);
            humantime();
            process.exit(1);
        },
        next       = function taskrunner_nextInit() {
            return;
        },
        diffFiles = function taskrunner_diffFiles(sampleName, sampleSource, sampleDiff) {
            var aa     = 0,
                line   = 0,
                pdlen  = 0,
                count  = [
                    0, 0
                ],
                diffs  = 0,
                lcount = 0,
                report = [],
                colors = {
                    del     : {
                        charEnd  : "\x1B[22m",
                        charStart: "\x1B[1m",
                        lineEnd  : "\x1B[39m",
                        lineStart: "\x1B[31m"
                    },
                    filepath: {
                        end  : "\x1B[39m",
                        start: "\x1B[36m"
                    },
                    ins     : {
                        charEnd  : "\x1B[22m",
                        charStart: "\x1B[1m",
                        lineEnd  : "\x1B[39m",
                        lineStart: "\x1B[32m"
                    }
                };
            options.mode    = "diff";
            options.source  = sampleSource;
            options.diff    = sampleDiff;
            options.diffcli = true;
            options.context = 2;
            options.lang    = "text";
            report          = prettydiff.api(options)[0];
            pdlen           = report[0].length;
            if (report.length < 3) {
                console.log("");
                console.log(colors.del.lineStart + "Test diff operation provided a bad code sample:" + colors.del.lineEnd);
                console.log(report[0]);
                return errout(colors.del.lineStart + "bad test" + colors.del.lineEnd);
            }
            count[0] += report[report.length - 1];
            // report indexes from diffcli feature of diffview.js 0 - source line number 1 -
            // source code line 2 - diff line number 3 - diff code line 4 - change 5 -
            // index of options.context (not parallel) 6 - total count of differences
            if (report[0][0] < 2) {
                diffs += 1;
                console.log("");
                console.log(colors.filepath.start + sampleName);
                console.log("Line: 1" + colors.filepath.end);
            }
            for (aa = 0; aa < pdlen; aa += 1) {
                if (report[4][aa] === "equal" && report[4][aa + 1] === "equal" && report[4][aa + 2] !== undefined && report[4][aa + 2] !== "equal") {
                    count[1] += 1;
                    if (count[1] === 51) {
                        break;
                    }
                    line   = report[0][aa] + 2;
                    lcount = 0;
                    diffs  += 1;
                    console.log("");
                    console.log(colors.filepath.start + sampleName);
                    console.log("Line: " + line + colors.filepath.end);
                    if (aa === 0) {
                        console.log(report[3][aa]);
                        console.log(report[3][aa + 1]);
                    }
                }
                if (lcount < 7) {
                    lcount += 1;
                    if (report[4][aa] === "delete" && report[0][aa] !== report[0][aa + 1]) {
                        if (report[1][aa] === "") {
                            report[1][aa] = "(empty line)";
                        } else if (report[1][aa].replace(/\ +/g, "") === "") {
                            report[1][aa] = "(indentation)";
                        }
                        console.log(colors.del.lineStart + report[1][aa].replace(/\\x1B/g, "\\x1B").replace(/<p(d)>/g, colors.del.charStart).replace(/<\/pd>/g, colors.del.charEnd) + colors.del.lineEnd);
                    } else if (report[4][aa] === "insert" && report[2][aa] !== report[2][aa + 1]) {
                        if (report[3][aa] === "") {
                            report[3][aa] = "(empty line)";
                        } else if (report[3][aa].replace(/\ +/g, "") === "") {
                            report[3][aa] = "(indentation)";
                        }
                        console.log(colors.ins.lineStart + report[3][aa].replace(/\\x1B/g, "\\x1B").replace(/<p(d)>/g, colors.ins.charStart).replace(/<\/pd>/g, colors.ins.charEnd) + colors.ins.lineEnd);
                    } else if (report[4][aa] === "equal" && aa > 1) {
                        console.log(report[3][aa]);
                    } else if (report[4][aa] === "replace") {
                        console.log(colors.del.lineStart + report[1][aa].replace(/\\x1B/g, "\\x1B").replace(/<p(d)>/g, colors.del.charStart).replace(/<\/pd>/g, colors.del.charEnd) + colors.del.lineEnd);
                        console.log(colors.ins.lineStart + report[3][aa].replace(/\\x1B/g, "\\x1B").replace(/<p(d)>/g, colors.ins.charStart).replace(/<\/pd>/g, colors.ins.charEnd) + colors.ins.lineEnd);
                    }
                }
            }
            console.log("");
            console.log(diffs + colors.filepath.start + " differences counted." + colors.filepath.end);
            if (sampleName !== "phases.simulations") {
                errout("Pretty Diff " + colors.del.lineStart + "failed" + colors.del.lineEnd + " on file: " + colors.filepath.start + sampleName + colors.filepath.end);
            }
        },
        phases     = {
            coreunits  : function taskrunner_coreunits() {
                var raw     = [],
                    correct = [],
                    countr  = 0,
                    countc  = 0,
                    utflag  = {
                        correct: false,
                        raw    : false
                    },
                    sort    = function taskrunner_coreunits_sort(a, b) {
                        if (a > b) {
                            return 1;
                        }
                        return -1;
                    },
                    compare = function taskrunner_coreunits_compare() {
                        var len       = (raw.length > correct.length)
                                ? raw.length
                                : correct.length,
                            a         = 0,
                            output    = "",
                            filecount = 0;
                        raw.sort(sort);
                        correct.sort(sort);
                        options = {
                            correct     : true,
                            crlf        : false,
                            html        : true,
                            inchar      : " ",
                            insize      : 4,
                            lang        : "auto",
                            methodchain : false,
                            mode        : "beautify",
                            nocaseindent: false,
                            objsort     : "all",
                            preserve    : 2,
                            quoteConvert: "double",
                            spaceclose  : true,
                            varword     : "none",
                            vertical    : "all",
                            wrap        : 80
                        };
                        for (a = 0; a < len; a += 1) {
                            if (raw[a] === undefined || correct[a] === undefined) {
                                if (raw[a] === undefined) {
                                    console.log("\x1B[33msamples_raw directory is missing file:\x1B[39m " + correct[a][0]);
                                    correct.splice(a, 1);
                                } else {
                                    console.log("\x1B[33msamples_correct directory is missing file:\x1B[39m " + raw[a][0]);
                                    raw.splice(a, 1);
                                }
                                len = (raw.length > correct.length)
                                    ? raw.length
                                    : correct.length;
                                a   -= 1;
                                if (a === len - 1) {
                                    console.log("");
                                    console.log("\x1B[32mCore Unit Testing Complete\x1B[39m");
                                    return next();
                                }
                            } else if (raw[a][0] === correct[a][0]) {
                                options.source = raw[a][1];
                                output         = prettydiff.api(options);
                                if (output.charAt(output.length - 1) !== "\n") {
                                    output = output + "\n";
                                }
                                if (output === correct[a][1]) {
                                    filecount += 1;
                                    console.log("\x1B[32mPretty Diff is good with file " + filecount + ":\x1B[39m " + correct[a][0]);
                                    if (a === len - 1) {
                                        return next();
                                    }
                                } else {
                                    diffFiles(correct[a][0], output, correct[a][1]);
                                }
                            } else {
                                if (raw[a][0] < correct[a][0]) {
                                    console.log("\x1B[33mCorrect samples directory is missing file:\x1B[39m " + raw[a][0]);
                                    raw.splice(a, 1);
                                } else {
                                    console.log("\x1B[33mRaw samples directory is missing file:\x1B[39m " + correct[a][0]);
                                    correct.splice(a, 1);
                                }
                                len = (raw.length > correct.length)
                                    ? raw.length
                                    : correct.length;
                                a   -= 1;
                                if (a === len - 1) {
                                    return next();
                                }
                            }
                        }
                    },
                    readDir = function taskrunner_coreunits_readDir(type) {
                        var dirpath = __dirname + "/samples_" + type;
                        fs.readdir(dirpath, function taskrunner_coreunits_readDir_callback(err, list) {
                            var pusher = function taskrunner_coreunits_readDir_callback_pusher(val, ind, arr) {
                                fs
                                    .readFile(__dirname + "/samples_" + type + "/" + val, "utf8", function taskrunner_coreunits_readDir_callback_pusher_readFile(erra, fileData) {
                                        if (erra !== null && erra !== undefined) {
                                            errout("Error reading file: " + __dirname + "/samples_" + type + "/" + val);
                                        } else if (type === "raw") {
                                            raw.push([val, fileData]);
                                            countr += 1;
                                            if (countr === arr.length) {
                                                utflag.raw = true;
                                                if (utflag.correct === true) {
                                                    compare("");
                                                }
                                            }
                                        } else if (type === "correct") {
                                            correct.push([val, fileData]);
                                            countc += 1;
                                            if (countc === arr.length) {
                                                utflag.correct = true;
                                                if (utflag.raw === true) {
                                                    compare("");
                                                }
                                            }
                                        }
                                        return ind;
                                    });
                            };
                            if (err !== null) {
                                errout("Error reading from directory: /samples_" + type);
                            }
                            list.forEach(pusher);
                        });
                    };
                console.log("");
                console.log("");
                console.log("\x1B[36mCore Unit Testing\x1B[39m");
                console.log("");
                readDir("raw");
                readDir("correct");
            },
            diffunits  : function taskrunner_diffunits() {
                return;
            },
            lint       : function taskrunner_lint() {
                var ignoreDirectory = [
                        ".vscode",
                        "ace",
                        "bin",
                        "coverage",
                        "ignore",
                        "JSLint",
                        "node_modules",
                        "test/samples_correct",
                        "test/samples_raw"
                    ],
                    flag            = {
                        files: false,
                        fs   : false,
                        items: false,
                        lint : false
                    },
                    files           = [],
                    jslint          = function taskrunner_declareJSLINT() {
                        return;
                    },
                    lintrun         = function taskrunner_lint_lintrun() {
                        var lintit = function taskrunner_lint_lintrun_lintit(val, ind, arr) {
                            var result = {},
                                failed = false,
                                ecount = 0,
                                report = function taskrunner_lint_lintrun_lintit_lintOn_report(warning) {
                                    //start with an exclusion list.  There are some warnings that I don't care about
                                    if (warning === null) {
                                        return;
                                    }
                                    if (warning.message.indexOf("Unexpected dangling '_'") === 0) {
                                        return;
                                    }
                                    if ((/Bad\ property\ name\ '\w+_'\./).test(warning.message) === true) {
                                        return;
                                    }
                                    if (warning.message.indexOf("/*global*/ requires") === 0) {
                                        return;
                                    }
                                    failed = true;
                                    if (ecount === 0) {
                                        console.log("\x1B[31mJSLint errors on\x1B[39m " + val[0]);
                                        console.log("");
                                    }
                                    ecount += 1;
                                    console.log("On line " + warning.line + " at column: " + warning.column);
                                    console.log(warning.message);
                                    console.log("");
                                };
                            options.source = val[1];
                            result = jslint(prettydiff.api(options), {"for":true});
                            if (result.ok === true) {
                                console.log("\x1B[32mLint is good for file " + (ind + 1) + ":\x1B[39m " + val[0]);
                                if (ind === arr.length - 1) {
                                    console.log("");
                                    console.log("\x1B[32mLint operation complete!\x1B[39m");
                                    console.log("");
                                    return next();
                                }
                            } else {
                                result.warnings.forEach(report);
                                if (failed === true) {
                                    errout("\x1B[31mLint fail\x1B[39m :(");
                                } else {
                                    console.log("\x1B[32mLint is good for file " + (ind + 1) + ":\x1B[39m " + val[0]);
                                    if (ind === arr.length - 1) {
                                        console.log("");
                                        console.log("\x1B[32mLint operation complete!\x1B[39m");
                                        console.log("");
                                        return next();
                                    }
                                }
                            }
                        };
                        options = {
                            correct     : false,
                            crlf        : false,
                            html        : true,
                            inchar      : " ",
                            insize      : 4,
                            lang        : "javascript",
                            methodchain : false,
                            mode        : "beautify",
                            nocaseindent: false,
                            objsort     : "all",
                            preserve    : true,
                            styleguide  : "jslint",
                            wrap        : 80
                        };
                        files.forEach(lintit);
                    };
                console.log("");
                console.log("");
                console.log("\x1B[36mBeautifying and Linting\x1B[39m");
                console.log("** Note that line numbers of error messaging reflects beautified code line.");
                console.log("");
                (function taskrunner_lint_install() {
                    var dateobj = new Date(),
                        day     = (dateobj.getDate() > 9)
                            ? "" + dateobj.getDate()
                            : "0" + dateobj.getDate(),
                        month   = (dateobj.getMonth() > 9)
                            ? "" + (dateobj.getMonth() + 1)
                            : "0" + (dateobj.getMonth() + 1),
                        date    = Number("" + dateobj.getFullYear() + month + day),
                        today   = require("./today.js").date;
                    fs.stat("JSLint", function taskrunner_lint_install_stat(erstat, stats) {
                        var child   = require("child_process").exec,
                            command = "git submodule foreach git pull origin master",
                            absent  = (JSON.stringify(erstat).indexOf("ENOENT") > -1),
                            childtask = function taskrunner_lint_install_stat_childtask() {
                                child(command, {
                                    timeout: 30000
                                }, function taskrunner_lint_install_stat_childtask_child(erchild, stdout, stderr) {
                                    var cdupcallback = function () {
                                        fs.readFile("JSLint/jslint.js", "utf8", function taskrunner_lint_install_stat_childtask_child_readFile(erread, data) {
                                            var moduleready = function taskrunner_lint_install_stat_childtask_child_callback() {
                                                jslint = require(process.cwd() + "/JSLint/jslint.js");
                                                fs.writeFile("test/today.js", "/*global exports*/var today=" + date + ";exports.date=today;", "utf8", function (werr) {
                                                    if (werr !== null && werr !== undefined) {
                                                        errout(werr);
                                                    }
                                                });
                                                console.log("\x1B[36mInstalled JSLint edition:\x1B[39m " + jslint().edition);
                                                flag.lint = true;
                                                if (flag.fs === true) {
                                                    lintrun();
                                                }
                                            };
                                            if (erread !== null && erread !== undefined) {
                                                return errout(erread);
                                            }
                                            //Only modify the jslint.js file once, so we have to check to see if it is already modified
                                            if (data.slice(data.length - 30).indexOf("\nmodule.exports = jslint;") < 0) {
                                                data = data + "\nmodule.exports = jslint;";
                                                fs.writeFile("JSLint/jslint.js", data, "utf8", function taskrunner_lint_install_stat_childtask_child_readFile_writeFile(erwrite) {
                                                    if (erwrite !== null && erwrite !== undefined) {
                                                        return errout(erwrite);
                                                    }
                                                    moduleready();
                                                });
                                            } else {
                                                moduleready();
                                            }
                                            return stdout;
                                        });
                                    };
                                    if (erchild !== null) {
                                        return errout(erchild);
                                    }
                                    if (typeof stderr === "string" && stderr.length > 0 && stderr.indexOf("Cloning into") < 0 && stderr.indexOf("From http") < 0) {
                                        return errout(stderr);
                                    }
                                    //jslint is now installed by clone or pull from github. If by "pull" then we are in the child directory and need to come up
                                    cdupcallback();
                                });
                            };
                        if (erstat !== null && erstat !== undefined && absent === false) {
                            return errout(erstat);
                        }
                        //does the directory JSLint exist? If not clone from github. If so then:
                        //* cd JSLint
                        //* git submodule foreach git pull origin master
                        //* cd ..
                        //Although changing directory is simple with process.chdir these must be issued as child processes to prevent interference from reading JavaScript files in the project
                        if (absent === false && stats.isDirectory() === true) {
                            //we only need to install once per day, so determine if JSLint has already installed today
                            if (today < date) {
                                console.log("Pulling latest JSLint...");
                                childtask();
                            } else {
                                jslint = require(process.cwd() + "/JSLint/jslint.js");
                                console.log("Running prior installed JSLint version " + jslint().edition + ".");
                                flag.lint = true;
                                if (flag.fs === true) {
                                    lintrun();
                                }
                            }
                        } else {
                            console.log("Cloning JSLint...");
                            command = "git submodule add https://github.com/douglascrockford/JSLint.git";
                            childtask();
                        }
                    });
                }());
                (function taskrunner_lint_getFiles() {
                    var fc       = 0,
                        ft       = 0,
                        total    = 0,
                        count    = 0,
                        idLen    = ignoreDirectory.length,
                        readFile = function taskrunner_lint_getFiles_readFile(filePath) {
                            fs
                                .readFile(filePath, "utf8", function taskrunner_lint_getFiles_readFile_callback(err, data) {
                                    if (err !== null && err !== undefined) {
                                        errout(err);
                                    }
                                    fc += 1;
                                    if (ft === fc) {
                                        flag.files = true;
                                    }
                                    if (path.sep === "\\") {
                                        files.push([
                                            filePath.slice(filePath.indexOf("\\prettydiff\\") + 14),
                                            data
                                        ]);
                                    } else {
                                        files.push([
                                            filePath.slice(filePath.indexOf("/prettydiff/") + 12),
                                            data
                                        ]);
                                    }
                                    if (flag.files === true && flag.items === true) {
                                        flag.fs = true;
                                        if (flag.lint === true) {
                                            flag.files = false;
                                            lintrun();
                                        }
                                    }
                                });
                        },
                        readDir  = function taskrunner_lint_getFiles_readDir(path) {
                            fs
                                .readdir(path, function taskrunner_lint_getFiles_readDir_callback(erra, list) {
                                    var fileEval = function taskrunner_lint_getFiles_readDir_callback_fileEval(val) {
                                        var filename = path + "/" + val;
                                        fs.stat(filename, function taskrunner_lint_getFiles_readDir_callback_fileEval_stat(errb, stat) {
                                            var a         = 0,
                                                ignoreDir = false;
                                            if (errb !== null) {
                                                return errout(errb);
                                            }
                                            count += 1;
                                            if (count === total) {
                                                flag.items = true;
                                            }
                                            if (stat.isFile() === true && (/(\.js)$/).test(val) === true) {
                                                ft += 1;
                                                readFile(filename);
                                            }
                                            if (stat.isDirectory() === true) {
                                                do {
                                                    if (val === ignoreDirectory[a]) {
                                                        ignoreDir = true;
                                                        break;
                                                    }
                                                    a += 1;
                                                } while (a < idLen);
                                                if (ignoreDir === true) {
                                                    if (flag.files === true && flag.items === true) {
                                                        flag.fs = true;
                                                        if (flag.lint === true) {
                                                            flag.items = false;
                                                            lintrun();
                                                        }
                                                    }
                                                } else {
                                                    taskrunner_lint_getFiles_readDir(filename);
                                                }
                                            }
                                        });
                                    };
                                    if (erra !== null) {
                                        return errout("Error reading path: " + path + "\n" + erra);
                                    }
                                    total += list.length;
                                    list.forEach(fileEval);
                                });
                        };
                    readDir(__dirname.replace(/((\/|\\)test)$/, ""));
                }());
            },
            packagejson: function taskrunner_packagejson() {
                fs
                    .readFile("package.json", "utf8", function taskrunner_packagejson_readFile(err, data) {
                        var prettydata = "",
                            globalmeta = "{\"difflines\":0,\"difftotal\":0,\"error\":\"\",\"insize\":xxx,\"lang\":[\"json\",\"javascript\",\"JSON\"],\"outsize\":xxx,\"time\":\"0.000 seconds\"}",
                            strmeta    = "";
                        if (err !== null && err !== undefined) {
                            errout("Cannot read package.json");
                        }
                        if (data.indexOf("_requiredBy") > 0) {
                            return next();
                        }
                        console.log("");
                        console.log("\x1B[36mTesting package.json beautification...\x1B[39m");
                        options.lang       = "auto";
                        options.mode       = "beautify";
                        options.objsort    = "all";
                        options.source     = data;
                        options.styleguide = "none";
                        options.vertical   = "all";
                        prettydata         = prettydiff.api(options);
                        strmeta            = JSON.stringify(global.meta).replace(/size":\d+/g, "size\":xxx").replace(/\d+\.\d+\ seconds/, "0.000 seconds");
                        if (data.replace(/(\s+)$/, "") !== prettydata.replace(/(\s+)$/, "")) {
                            diffFiles("package.json", data, prettydata);
                            errout("\x1B[31mPretty Diff corrupted package.json\x1B[36m");
                        }
                        console.log("\x1B[32mThe package.json file is beautified properly.\x1B[36m");
                        if (strmeta !== globalmeta) {
                            diffFiles("package.json", strmeta, globalmeta);
                            errout("\x1B[31mglobal.meta is broken from package.json beautification.\x1B[39m");
                            console.log("");
                        }
                        console.log("\x1B[32mglobal.meta global object is properly constructed.\x1B[39m");
                        return next();
                    });
            },
            simulations: function taskrunner_simulations() {
                var passcount = [], //passing tests in local group
                    finished  = [], //completed tests in local group
                    grouplen  = [], //length of local group
                    groupname = [], //name of current group
                    teardowns = [], //a list of tear down lists
                    units     = [], //test unit arrays
                    index     = [], //current array index of current group
                    total     = 0, //total number of tests
                    gcount    = 0, //total number of groups
                    fgroup    = 0, //total number of groups containing failed tests
                    fails     = 0, //total number of failed tests
                    depth     = -1, //current depth
                    single    = false, //look for the unit test file
                    tablen    = 2, //size of indentation in spaces
                    tests     = [
                        {
                            buildup : [
                                "mkdir test/simulation",
                                "echo \"<a><b> <c/>    </b></a>\" > test/simulation/testa.txt",
                                "echo \"<a><b> <d/>    </b></a>\" > test/simulation/testb.txt",
                                "echo \"\" > test/simulation/testa1.txt",
                                "echo \"\" > test/simulation/testb1.txt",
                                "echo \"some simple text for an example\" > test/simulation/testc1.txt",
                                "echo \"\" > test/simulation/testd1.txt"
                            ],
                            group   : "api simulation - node-local.js",
                            teardown: ["rm -rf test/simulation"],
                            units   : [
                                {
                                    group: "readmethod: screen",
                                    units: [
                                        {
                                            check : "node api/node-local.js source:\"<a><b> <c/>    </b></a>\" readmethod:\"screen\" " +
                                                        "mode:\"beautify\"",
                                            name  : "Beautify markup.",
                                            verify: "<a>\n    <b>\n        <c/>\n    </b>\n</a>"
                                        }, {
                                            check : "node api/node-local.js source:\"<a><b> <c/>    </b></a>\" readmethod:\"screen\" " +
                                                        "mode:\"minify\"",
                                            name  : "Minify markup.",
                                            verify: "<a><b> <c/> </b></a>"
                                        }, {
                                            check : "node api/node-local.js source:\"<a><b> <c/>    </b></a>\" readmethod:\"screen\" " +
                                                        "mode:\"parse\"",
                                            name  : "Parse markup.",
                                            verify: "{\"data\":{\"attrs\":[[],[],[],[],[]],\"jscom\":[false,false,false,false,false],\"linen\":[1,1,1,1,1],\"lines\":[0,0,1,1,0],\"presv\":[false,false,false,false,false],\"token\":[\"<a>\",\"<b>\",\"<c/>\",\"</b>\",\"</a>\"],\"types\":[\"start\",\"start\",\"singleton\",\"end\",\"end\"]},\"definition\":{\"attrs\":\"array - List of attributes (if any) for the given token\",\"jscom\":\"boolean - Whether the token is a JavaScript comment if in JSX format\",\"linen\":\"number - The line number in the original source where the token started, which is used for reporting and analysis\",\"lines\":\"number - Whether the token is preceeded any space and/or line breaks in the original code source\",\"presv\":\"boolean - Whether the token is preserved verbatim as found.  Useful for comments and HTML 'pre' tags.\",\"token\":\"string - The parsed code tokens\",\"types\":\"string - Data types of the tokens: cdata, comment, conditional, content, end, ignore, linepreserve, script, sgml, singleton, start, template, template_else, template_end, template_start, xml\"}}"
                                        }, {
                                            check : "node api/node-local.js source:\"<a><b> <c/>    </b></a>\" readmethod:\"screen\" " +
                                                        "mode:\"diff\" diff:\"<a><b> <d/>    </b></a>\"",
                                            name  : "Diff markup.",
                                            verify: "<?xml version=\"1.0\" encoding=\"UTF-8\" ?><!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\"><html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\"><head><title>Pretty Diff - The difference tool</title><meta name=\"robots\" content=\"index, follow\"/> <meta name=\"DC.title\" content=\"Pretty Diff - The difference tool\"/> <link rel=\"canonical\" href=\"http://prettydiff.com/\" type=\"application/xhtml+xml\"/><meta http-equiv=\"Content-Type\" content=\"application/xhtml+xml;charset=UTF-8\"/><meta http-equiv=\"Content-Style-Type\" content=\"text/css\"/><style type=\"text/css\">/*<![CDATA[*/#prettydiff.canvas{background:#986 url(\"data:image/png;base64,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/GMzLdsAAEFdaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzAxNCA3OS4xNTY3OTcsIDIwMTQvMDgvMjAtMDk6NTM6MDIgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICAgICAgICAgIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNCAoTWFjaW50b3NoKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAxNi0wMS0xMlQxMjoyNDozOC0wNjowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMTYtMDEtMTNUMTM6MTg6MDctMDY6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDE2LTAxLTEzVDEzOjE4OjA3LTA2OjAwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+eG1wLmlpZDoxZGYzYjhkMy03NzgyLTQ0MGUtYjA5OS1iYjM5NjA0MDVhOWQ8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElEPmFkb2JlOmRvY2lkOnBob3Rvc2hvcDoxYzM3NjE4MS1mOWU4LTExNzgtOWE5Yy1kODI1ZGZiMGE0NzA8L3htcE1NOkRvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ+eG1wLmRpZDo2YjI0ZTI3YS1jZjA3LTQ5ZDEtOWIwZC02ODEzMTFkNzQwMzE8L3htcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOkhpc3Rvcnk+CiAgICAgICAgICAgIDxyZGY6U2VxPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5jcmVhdGVkPC9zdEV2dDphY3Rpb24+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDppbnN0YW5jZUlEPnhtcC5paWQ6NmIyNGUyN2EtY2YwNy00OWQxLTliMGQtNjgxMzExZDc0MDMxPC9zdEV2dDppbnN0YW5jZUlEPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6d2hlbj4yMDE2LTAxLTEyVDEyOjI0OjM4LTA2OjAwPC9zdEV2dDp3aGVuPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6c29mdHdhcmVBZ2VudD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNCAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPnNhdmVkPC9zdEV2dDphY3Rpb24+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDppbnN0YW5jZUlEPnhtcC5paWQ6ZDUzYzc4NDMtYTVmMi00ODQ3LThjNDMtNmUyYzBhNDY4YmViPC9zdEV2dDppbnN0YW5jZUlEPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6d2hlbj4yMDE2LTAxLTEyVDEyOjI0OjM4LTA2OjAwPC9zdEV2dDp3aGVuPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6c29mdHdhcmVBZ2VudD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNCAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmNoYW5nZWQ+Lzwvc3RFdnQ6Y2hhbmdlZD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmRlcml2ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnBhcmFtZXRlcnM+Y29udmVydGVkIGZyb20gaW1hZ2UvcG5nIHRvIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3A8L3N0RXZ0OnBhcmFtZXRlcnM+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5zYXZlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjgzYTc5MGFkLWMwZWQtNGIzYS05ZDJhLWE5YzQ2MWRmMzVhMTwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAxNi0wMS0xM1QxMzoxMzoyMy0wNjowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpjaGFuZ2VkPi88L3N0RXZ0OmNoYW5nZWQ+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5kZXJpdmVkPC9zdEV2dDphY3Rpb24+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpwYXJhbWV0ZXJzPmNvbnZlcnRlZCBmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nPC9zdEV2dDpwYXJhbWV0ZXJzPgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+c2F2ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDoxZGYzYjhkMy03NzgyLTQ0MGUtYjA5OS1iYjM5NjA0MDVhOWQ8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMTYtMDEtMTNUMTM6MTg6MDctMDY6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAgICAgICAgICA8c3RFdnQ6Y2hhbmdlZD4vPC9zdEV2dDpjaGFuZ2VkPgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAgICAgIDx4bXBNTTpEZXJpdmVkRnJvbSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgIDxzdFJlZjppbnN0YW5jZUlEPnhtcC5paWQ6ODNhNzkwYWQtYzBlZC00YjNhLTlkMmEtYTljNDYxZGYzNWExPC9zdFJlZjppbnN0YW5jZUlEPgogICAgICAgICAgICA8c3RSZWY6ZG9jdW1lbnRJRD54bXAuZGlkOjgzYTc5MGFkLWMwZWQtNGIzYS05ZDJhLWE5YzQ2MWRmMzVhMTwvc3RSZWY6ZG9jdW1lbnRJRD4KICAgICAgICAgICAgPHN0UmVmOm9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjZiMjRlMjdhLWNmMDctNDlkMS05YjBkLTY4MTMxMWQ3NDAzMTwvc3RSZWY6b3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8L3htcE1NOkRlcml2ZWRGcm9tPgogICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3BuZzwvZGM6Zm9ybWF0PgogICAgICAgICA8cGhvdG9zaG9wOkNvbG9yTW9kZT4zPC9waG90b3Nob3A6Q29sb3JNb2RlPgogICAgICAgICA8cGhvdG9zaG9wOklDQ1Byb2ZpbGU+c1JHQiBJRUM2MTk2Ni0yLjE8L3Bob3Rvc2hvcDpJQ0NQcm9maWxlPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpYUmVzb2x1dGlvbj4zMDAwMDAwLzEwMDAwPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj4zMDAwMDAwLzEwMDAwPC90aWZmOllSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpSZXNvbHV0aW9uVW5pdD4yPC90aWZmOlJlc29sdXRpb25Vbml0PgogICAgICAgICA8ZXhpZjpDb2xvclNwYWNlPjE8L2V4aWY6Q29sb3JTcGFjZT4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjQ8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+NDwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgIAo8P3hwYWNrZXQgZW5kPSJ3Ij8+bleIyQAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAAANElEQVR42mJ89+4uAwMDAwPD6lkTGd69u/vu3d2ZHXnv3t1lgLPevbvLrCTIEJqWD1EJGADaTRll80WcLAAAAABJRU5ErkJggg==\");color:#420}#prettydiff.canvas *:focus{outline:0.1em dashed #f00}#prettydiff.canvas a{color:#039}#prettydiff.canvas .contentarea,#prettydiff.canvas legend,#prettydiff.canvas fieldset select,#prettydiff.canvas .diff td,#prettydiff.canvas .report td,#prettydiff.canvas .data li,#prettydiff.canvas .diff-right,#prettydiff.canvas fieldset input{background:#eeeee8;border-color:#420}#prettydiff.canvas select,#prettydiff.canvas input,#prettydiff.canvas .diff,#prettydiff.canvas .beautify,#prettydiff.canvas .report,#prettydiff.canvas .beautify h3,#prettydiff.canvas .diff h3,#prettydiff.canvas .beautify h4,#prettydiff.canvas .diff h4,#prettydiff.canvas #report,#prettydiff.canvas #report .author,#prettydiff.canvas fieldset{background:#ddddd8;border-color:#420}#prettydiff.canvas fieldset fieldset{background:#eeeee8}#prettydiff.canvas fieldset fieldset input,#prettydiff.canvas fieldset fieldset select{background:#ddddd8}#prettydiff.canvas h2,#prettydiff.canvas h2 button,#prettydiff.canvas h3,#prettydiff.canvas legend{color:#900}#prettydiff.canvas .contentarea{box-shadow:0 1em 1em #b8a899}#prettydiff.canvas .segment{background:#fff}#prettydiff.canvas h2 button,#prettydiff.canvas .segment,#prettydiff.canvas ol.segment li{border-color:#420}#prettydiff.canvas th{background:#e8ddcc}#prettydiff.canvas li h4{color:#06f}#prettydiff.canvas code{background:#eee;border-color:#eee;color:#00f}#prettydiff.canvas ol.segment h4 strong{color:#c00}#prettydiff.canvas button{background-color:#ddddd8;border-color:#420;box-shadow:0 0.25em 0.5em #b8a899;color:#900}#prettydiff.canvas button:hover{background-color:#ccb;border-color:#630;box-shadow:0 0.25em 0.5em #b8a899;color:#630}#prettydiff.canvas th{background:#ccccc8}#prettydiff.canvas thead th,#prettydiff.canvas th.heading{background:#ccb}#prettydiff.canvas .diff h3{background:#ddd;border-color:#999}#prettydiff.canvas td,#prettydiff.canvas th,#prettydiff.canvas .segment,#prettydiff.canvas .count li,#prettydiff.canvas .data li,#prettydiff.canvas .diff-right{border-color:#ccccc8}#prettydiff.canvas .count{background:#eed;border-color:#999}#prettydiff.canvas .count li.fold{color:#900}#prettydiff.canvas h2 button{background:#f8f8f8;box-shadow:0.1em 0.1em 0.25em #ddd}#prettydiff.canvas li h4{color:#00f}#prettydiff.canvas code{background:#eee;border-color:#eee;color:#009}#prettydiff.canvas ol.segment h4 strong{color:#c00}#prettydiff.canvas .data .delete{background:#ffd8d8}#prettydiff.canvas .data .delete em{background:#fff8f8;border-color:#c44;color:#900}#prettydiff.canvas .data .insert{background:#d8ffd8}#prettydiff.canvas .data .insert em{background:#f8fff8;border-color:#090;color:#363}#prettydiff.canvas .data .replace{background:#fec}#prettydiff.canvas .data .replace em{background:#ffe;border-color:#a86;color:#852}#prettydiff.canvas .data .empty{background:#ddd}#prettydiff.canvas .data em.s0{color:#000}#prettydiff.canvas .data em.s1{color:#f66}#prettydiff.canvas .data em.s2{color:#12f}#prettydiff.canvas .data em.s3{color:#090}#prettydiff.canvas .data em.s4{color:#d6d}#prettydiff.canvas .data em.s5{color:#7cc}#prettydiff.canvas .data em.s6{color:#c85}#prettydiff.canvas .data em.s7{color:#737}#prettydiff.canvas .data em.s8{color:#6d0}#prettydiff.canvas .data em.s9{color:#dd0}#prettydiff.canvas .data em.s10{color:#893}#prettydiff.canvas .data em.s11{color:#b97}#prettydiff.canvas .data em.s12{color:#bbb}#prettydiff.canvas .data em.s13{color:#cc3}#prettydiff.canvas .data em.s14{color:#333}#prettydiff.canvas .data em.s15{color:#9d9}#prettydiff.canvas .data em.s16{color:#880}#prettydiff.canvas .data .l0{background:#eeeee8}#prettydiff.canvas .data .l1{background:#fed}#prettydiff.canvas .data .l2{background:#def}#prettydiff.canvas .data .l3{background:#efe}#prettydiff.canvas .data .l4{background:#fef}#prettydiff.canvas .data .l5{background:#eef}#prettydiff.canvas .data .l6{background:#fff8cc}#prettydiff.canvas .data .l7{background:#ede}#prettydiff.canvas .data .l8{background:#efc}#prettydiff.canvas .data .l9{background:#ffd}#prettydiff.canvas .data .l10{background:#edc}#prettydiff.canvas .data .l11{background:#fdb}#prettydiff.canvas .data .l12{background:#f8f8f8}#prettydiff.canvas .data .l13{background:#ffb}#prettydiff.canvas .data .l14{background:#eec}#prettydiff.canvas .data .l15{background:#cfc}#prettydiff.canvas .data .l16{background:#eea}#prettydiff.canvas .data .c0{background:inherit}#prettydiff.canvas #report p em{color:#060}#prettydiff.canvas #report p strong{color:#009}#prettydiff.shadow{background:#333 url(\"data:image/png;base64,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/GMzLdsAAEQFaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzAxNCA3OS4xNTY3OTcsIDIwMTQvMDgvMjAtMDk6NTM6MDIgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICAgICAgICAgIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNCAoTWFjaW50b3NoKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAxNi0wMS0xMlQxMjoyNDozOC0wNjowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMTYtMDEtMTNUMTU6MTE6MzMtMDY6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDE2LTAxLTEzVDE1OjExOjMzLTA2OjAwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+eG1wLmlpZDo4MDAwYTE3Zi1jZTY1LTQ5NTUtYjFmMS05YjVkODIwNDIyNjU8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgICAgIDx4bXBNTTpEb2N1bWVudElEPmFkb2JlOmRvY2lkOnBob3Rvc2hvcDoxZmZhNDk1Yy1mYTU2LTExNzgtOWE5Yy1kODI1ZGZiMGE0NzA8L3htcE1NOkRvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ+eG1wLmRpZDo2YjI0ZTI3YS1jZjA3LTQ5ZDEtOWIwZC02ODEzMTFkNzQwMzE8L3htcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOkhpc3Rvcnk+CiAgICAgICAgICAgIDxyZGY6U2VxPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5jcmVhdGVkPC9zdEV2dDphY3Rpb24+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDppbnN0YW5jZUlEPnhtcC5paWQ6NmIyNGUyN2EtY2YwNy00OWQxLTliMGQtNjgxMzExZDc0MDMxPC9zdEV2dDppbnN0YW5jZUlEPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6d2hlbj4yMDE2LTAxLTEyVDEyOjI0OjM4LTA2OjAwPC9zdEV2dDp3aGVuPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6c29mdHdhcmVBZ2VudD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNCAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPnNhdmVkPC9zdEV2dDphY3Rpb24+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDppbnN0YW5jZUlEPnhtcC5paWQ6ZDUzYzc4NDMtYTVmMi00ODQ3LThjNDMtNmUyYzBhNDY4YmViPC9zdEV2dDppbnN0YW5jZUlEPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6d2hlbj4yMDE2LTAxLTEyVDEyOjI0OjM4LTA2OjAwPC9zdEV2dDp3aGVuPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6c29mdHdhcmVBZ2VudD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNCAoTWFjaW50b3NoKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmNoYW5nZWQ+Lzwvc3RFdnQ6Y2hhbmdlZD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmRlcml2ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnBhcmFtZXRlcnM+Y29udmVydGVkIGZyb20gaW1hZ2UvcG5nIHRvIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3A8L3N0RXZ0OnBhcmFtZXRlcnM+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5zYXZlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjgzYTc5MGFkLWMwZWQtNGIzYS05ZDJhLWE5YzQ2MWRmMzVhMTwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAxNi0wMS0xM1QxMzoxMzoyMy0wNjowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpjaGFuZ2VkPi88L3N0RXZ0OmNoYW5nZWQ+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5zYXZlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjA0ZGYyNDk5LWE1NTktNDE4MC1iNjA1LWI2MTk3MWMxNWEwMzwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAxNi0wMS0xM1QxNToxMTozMy0wNjowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpjaGFuZ2VkPi88L3N0RXZ0OmNoYW5nZWQ+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5jb252ZXJ0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnBhcmFtZXRlcnM+ZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL3BuZzwvc3RFdnQ6cGFyYW1ldGVycz4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmRlcml2ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnBhcmFtZXRlcnM+Y29udmVydGVkIGZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9wbmc8L3N0RXZ0OnBhcmFtZXRlcnM+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5zYXZlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjgwMDBhMTdmLWNlNjUtNDk1NS1iMWYxLTliNWQ4MjA0MjI2NTwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAxNi0wMS0xM1QxNToxMTozMy0wNjowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpjaGFuZ2VkPi88L3N0RXZ0OmNoYW5nZWQ+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgICAgPHhtcE1NOkRlcml2ZWRGcm9tIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgPHN0UmVmOmluc3RhbmNlSUQ+eG1wLmlpZDowNGRmMjQ5OS1hNTU5LTQxODAtYjYwNS1iNjE5NzFjMTVhMDM8L3N0UmVmOmluc3RhbmNlSUQ+CiAgICAgICAgICAgIDxzdFJlZjpkb2N1bWVudElEPnhtcC5kaWQ6ODNhNzkwYWQtYzBlZC00YjNhLTlkMmEtYTljNDYxZGYzNWExPC9zdFJlZjpkb2N1bWVudElEPgogICAgICAgICAgICA8c3RSZWY6b3JpZ2luYWxEb2N1bWVudElEPnhtcC5kaWQ6NmIyNGUyN2EtY2YwNy00OWQxLTliMGQtNjgxMzExZDc0MDMxPC9zdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDwveG1wTU06RGVyaXZlZEZyb20+CiAgICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2UvcG5nPC9kYzpmb3JtYXQ+CiAgICAgICAgIDxwaG90b3Nob3A6Q29sb3JNb2RlPjM8L3Bob3Rvc2hvcDpDb2xvck1vZGU+CiAgICAgICAgIDxwaG90b3Nob3A6SUNDUHJvZmlsZT5zUkdCIElFQzYxOTY2LTIuMTwvcGhvdG9zaG9wOklDQ1Byb2ZpbGU+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjMwMDAwMDAvMTAwMDA8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjMwMDAwMDAvMTAwMDA8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+NDwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj40PC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBlbmQ9InciPz5hSvvCAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAAlSURBVHjaPMYxAQAwDAMgVkv1VFFRuy9cvN0F7m66JNNhOvwBAPyqCtNeO5K2AAAAAElFTkSuQmCC\");color:#fff}#prettydiff.shadow *:focus{outline:0.1em dashed #ff0}#prettydiff.shadow a:visited{color:#f93}#prettydiff.shadow a{color:#cf3}#prettydiff.shadow .contentarea,#prettydiff.shadow legend,#prettydiff.shadow fieldset select,#prettydiff.shadow .diff td,#prettydiff.shadow .report td,#prettydiff.shadow .data li,#prettydiff.shadow .diff-right,#prettydiff.shadow fieldset input{background:#333;border-color:#666}#prettydiff.shadow select,#prettydiff.shadow input,#prettydiff.shadow .diff,#prettydiff.shadow .beautify,#prettydiff.shadow .report,#prettydiff.shadow .beautify h3,#prettydiff.shadow .diff h3,#prettydiff.shadow .beautify h4,#prettydiff.shadow .diff h4,#prettydiff.shadow #report,#prettydiff.shadow #report .author,#prettydiff.shadow fieldset{background:#222;border-color:#666}#prettydiff.shadow fieldset fieldset{background:#333}#prettydiff.shadow fieldset fieldset input,#prettydiff.shadow fieldset fieldset select{background:#222}#prettydiff.shadow h2,#prettydiff.shadow h2 button,#prettydiff.shadow h3,#prettydiff.shadow input,#prettydiff.shadow option,#prettydiff.shadow select,#prettydiff.shadow legend{color:#ccc}#prettydiff.shadow .contentarea{box-shadow:0 1em 1em #000}#prettydiff.shadow .segment{background:#222}#prettydiff.shadow h2 button,#prettydiff.shadow td,#prettydiff.shadow th,#prettydiff.shadow .segment,#prettydiff.shadow ol.segment li{border-color:#666}#prettydiff.shadow .count li.fold{color:#cf3}#prettydiff.shadow th{background:#000}#prettydiff.shadow h2 button{background:#585858;box-shadow:0.1em 0.1em 0.25em #000}#prettydiff.shadow li h4{color:#ff0}#prettydiff.shadow code{background:#585858;border-color:#585858;color:#ccf}#prettydiff.shadow ol.segment h4 strong{color:#f30}#prettydiff.shadow button{background-color:#333;border-color:#666;box-shadow:0 0.25em 0.5em #000;color:#ccc}#prettydiff.shadow button:hover{background-color:#777;border-color:#aaa;box-shadow:0 0.25em 0.5em #222;color:#fff}#prettydiff.shadow th{background:#444}#prettydiff.shadow thead th,#prettydiff.shadow th.heading{background:#444}#prettydiff.shadow .diff h3{background:#000;border-color:#666}#prettydiff.shadow .segment,#prettydiff.shadow .data li,#prettydiff.shadow .diff-right{border-color:#444}#prettydiff.shadow .count li{border-color:#333}#prettydiff.shadow .count{background:#555;border-color:#333}#prettydiff.shadow li h4{color:#ff0}#prettydiff.shadow code{background:#000;border-color:#000;color:#ddd}#prettydiff.shadow ol.segment h4 strong{color:#c00}#prettydiff.shadow .data .delete{background:#300}#prettydiff.shadow .data .delete em{background:#200;border-color:#c63;color:#c66}#prettydiff.shadow .data .insert{background:#030}#prettydiff.shadow .data .insert em{background:#010;border-color:#090;color:#6c0}#prettydiff.shadow .data .replace{background:#345}#prettydiff.shadow .data .replace em{background:#023;border-color:#09c;color:#7cf}#prettydiff.shadow .data .empty{background:#111}#prettydiff.shadow .diff .author{border-color:#666}#prettydiff.shadow .data em.s0{color:#fff}#prettydiff.shadow .data em.s1{color:#d60}#prettydiff.shadow .data em.s2{color:#aaf}#prettydiff.shadow .data em.s3{color:#0c0}#prettydiff.shadow .data em.s4{color:#f6f}#prettydiff.shadow .data em.s5{color:#0cc}#prettydiff.shadow .data em.s6{color:#dc3}#prettydiff.shadow .data em.s7{color:#a7a}#prettydiff.shadow .data em.s8{color:#7a7}#prettydiff.shadow .data em.s9{color:#ff6}#prettydiff.shadow .data em.s10{color:#33f}#prettydiff.shadow .data em.s11{color:#933}#prettydiff.shadow .data em.s12{color:#990}#prettydiff.shadow .data em.s13{color:#987}#prettydiff.shadow .data em.s14{color:#fc3}#prettydiff.shadow .data em.s15{color:#897}#prettydiff.shadow .data em.s16{color:#f30}#prettydiff.shadow .data .l0{background:#333}#prettydiff.shadow .data .l1{background:#633}#prettydiff.shadow .data .l2{background:#335}#prettydiff.shadow .data .l3{background:#353}#prettydiff.shadow .data .l4{background:#636}#prettydiff.shadow .data .l5{background:#366}#prettydiff.shadow .data .l6{background:#640}#prettydiff.shadow .data .l7{background:#303}#prettydiff.shadow .data .l8{background:#030}#prettydiff.shadow .data .l9{background:#660}#prettydiff.shadow .data .l10{background:#003}#prettydiff.shadow .data .l11{background:#300}#prettydiff.shadow .data .l12{background:#553}#prettydiff.shadow .data .l13{background:#432}#prettydiff.shadow .data .l14{background:#640}#prettydiff.shadow .data .l15{background:#562}#prettydiff.shadow .data .l16{background:#600}#prettydiff.shadow .data .c0{background:inherit}#prettydiff.white{background:#f8f8f8 url(\"data:image/png;base64,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/GMzLdsAADo2aVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzAxNCA3OS4xNTY3OTcsIDIwMTQvMDgvMjAtMDk6NTM6MDIgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICAgICAgICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgICAgICAgICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE0IChNYWNpbnRvc2gpPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgIDx4bXA6Q3JlYXRlRGF0ZT4yMDE2LTAxLTEyVDEyOjI0OjM4LTA2OjAwPC94bXA6Q3JlYXRlRGF0ZT4KICAgICAgICAgPHhtcDpNZXRhZGF0YURhdGU+MjAxNi0wMS0xMlQxMjoyNDozOC0wNjowMDwveG1wOk1ldGFkYXRhRGF0ZT4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTYtMDEtMTJUMTI6MjQ6MzgtMDY6MDA8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wTU06SW5zdGFuY2VJRD54bXAuaWlkOmQ1M2M3ODQzLWE1ZjItNDg0Ny04YzQzLTZlMmMwYTQ2OGJlYjwveG1wTU06SW5zdGFuY2VJRD4KICAgICAgICAgPHhtcE1NOkRvY3VtZW50SUQ+YWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjFjMzc2MTgxLWY5ZTgtMTE3OC05YTljLWQ4MjVkZmIwYTQ3MDwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOjZiMjRlMjdhLWNmMDctNDlkMS05YjBkLTY4MTMxMWQ3NDAzMTwveG1wTU06T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNyZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDo2YjI0ZTI3YS1jZjA3LTQ5ZDEtOWIwZC02ODEzMTFkNzQwMzE8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMTYtMDEtMTJUMTI6MjQ6MzgtMDY6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDphY3Rpb24+c2F2ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDpkNTNjNzg0My1hNWYyLTQ4NDctOGM0My02ZTJjMGE0NjhiZWI8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMTYtMDEtMTJUMTI6MjQ6MzgtMDY6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE0IChNYWNpbnRvc2gpPC9zdEV2dDpzb2Z0d2FyZUFnZW50PgogICAgICAgICAgICAgICAgICA8c3RFdnQ6Y2hhbmdlZD4vPC9zdEV2dDpjaGFuZ2VkPgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOkhpc3Rvcnk+CiAgICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2UvcG5nPC9kYzpmb3JtYXQ+CiAgICAgICAgIDxwaG90b3Nob3A6Q29sb3JNb2RlPjM8L3Bob3Rvc2hvcDpDb2xvck1vZGU+CiAgICAgICAgIDxwaG90b3Nob3A6SUNDUHJvZmlsZT5zUkdCIElFQzYxOTY2LTIuMTwvcGhvdG9zaG9wOklDQ1Byb2ZpbGU+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjMwMDAwMDAvMTAwMDA8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjMwMDAwMDAvMTAwMDA8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+NDwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj40PC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBlbmQ9InciPz5cKgaXAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAAkSURBVHjaPMahAQAwDMCg7P+/KnsPcq4oHqpqdwNmBt3QDX8AeAUmcrZLnM4AAAAASUVORK5CYII=\")}#prettydiff.white *:focus{outline:0.1em dashed #06f}#prettydiff.white .contentarea,#prettydiff.white legend,#prettydiff.white fieldset select,#prettydiff.white .diff td,#prettydiff.white .report td,#prettydiff.white .data li,#prettydiff.white .diff-right,#prettydiff.white fieldset input{background:#fff;border-color:#999}#prettydiff.white select,#prettydiff.white input,#prettydiff.white .diff,#prettydiff.white .beautify,#prettydiff.white .report,#prettydiff.white .beautify h3,#prettydiff.white .diff h3,#prettydiff.white .beautify h4,#prettydiff.white .diff h4,#prettydiff.white #pdsamples li div,#prettydiff.white #report,#prettydiff.white .author,#prettydiff.white #report .author,#prettydiff.white fieldset{background:#eee;border-color:#999}#prettydiff.white .diff h3{background:#ddd;border-color:#999}#prettydiff.white fieldset fieldset{background:#ddd}#prettydiff.white .contentarea{box-shadow:0 1em 1em #999}#prettydiff.white button{background-color:#eee;border-color:#999;box-shadow:0 0.25em 0.5em #ccc;color:#666}#prettydiff.white button:hover{background-color:#def;border-color:#03c;box-shadow:0 0.25em 0.5em #ccf;color:#03c}#prettydiff.white h2,#prettydiff.white h2 button,#prettydiff.white h3{color:#b00}#prettydiff.white th{background:#eee;color:#333}#prettydiff.white thead th{background:#eef}#prettydiff.white .report strong{color:#009}#prettydiff.white .report em{color:#080}#prettydiff.white h2 button,#prettydiff.white td,#prettydiff.white th,#prettydiff.white .segment,#prettydiff.white .count li,#prettydiff.white .diff-right #prettydiff.white ol.segment li{border-color:#ccc}#prettydiff.white .data li{border-color:#ccc}#prettydiff.white .count li.fold{color:#900}#prettydiff.white .count{background:#eed;border-color:#999}#prettydiff.white h2 button{background:#f8f8f8;box-shadow:0.1em 0.1em 0.25em #ddd}#prettydiff.white li h4{color:#00f}#prettydiff.white code{background:#eee;border-color:#eee;color:#009}#prettydiff.white ol.segment h4 strong{color:#c00}#prettydiff.white .data .delete{background:#ffd8d8}#prettydiff.white .data .delete em{background:#fff8f8;border-color:#c44;color:#900}#prettydiff.white .data .insert{background:#d8ffd8}#prettydiff.white .data .insert em{background:#f8fff8;border-color:#090;color:#363}#prettydiff.white .data .replace{background:#fec}#prettydiff.white .data .replace em{background:#ffe;border-color:#a86;color:#852}#prettydiff.white .data .empty{background:#ddd}#prettydiff.white .data em.s0{color:#000}#prettydiff.white .data em.s1{color:#f66}#prettydiff.white .data em.s2{color:#12f}#prettydiff.white .data em.s3{color:#090}#prettydiff.white .data em.s4{color:#d6d}#prettydiff.white .data em.s5{color:#7cc}#prettydiff.white .data em.s6{color:#c85}#prettydiff.white .data em.s7{color:#737}#prettydiff.white .data em.s8{color:#6d0}#prettydiff.white .data em.s9{color:#dd0}#prettydiff.white .data em.s10{color:#893}#prettydiff.white .data em.s11{color:#b97}#prettydiff.white .data em.s12{color:#bbb}#prettydiff.white .data em.s13{color:#cc3}#prettydiff.white .data em.s14{color:#333}#prettydiff.white .data em.s15{color:#9d9}#prettydiff.white .data em.s16{color:#880}#prettydiff.white .data .l0{background:#fff}#prettydiff.white .data .l1{background:#fed}#prettydiff.white .data .l2{background:#def}#prettydiff.white .data .l3{background:#efe}#prettydiff.white .data .l4{background:#fef}#prettydiff.white .data .l5{background:#eef}#prettydiff.white .data .l6{background:#fff8cc}#prettydiff.white .data .l7{background:#ede}#prettydiff.white .data .l8{background:#efc}#prettydiff.white .data .l9{background:#ffd}#prettydiff.white .data .l10{background:#edc}#prettydiff.white .data .l11{background:#fdb}#prettydiff.white .data .l12{background:#f8f8f8}#prettydiff.white .data .l13{background:#ffb}#prettydiff.white .data .l14{background:#eec}#prettydiff.white .data .l15{background:#cfc}#prettydiff.white .data .l16{background:#eea}#prettydiff.white .data .c0{background:inherit}#prettydiff.white #report p em{color:#080}#prettydiff.white #report p strong{color:#009}#prettydiff #report.contentarea{font-family:\"Lucida Sans Unicode\",\"Helvetica\",\"Arial\",sans-serif;max-width:none;overflow:scroll}#prettydiff .diff .replace em,#prettydiff .diff .delete em,#prettydiff .diff .insert em{border-style:solid;border-width:0.1em}#prettydiff #report dd,#prettydiff #report dt,#prettydiff #report p,#prettydiff #report li,#prettydiff #report td,#prettydiff #report blockquote,#prettydiff #report th{font-family:\"Lucida Sans Unicode\",\"Helvetica\",\"Arial\",sans-serif;font-size:1.2em}#prettydiff div#webtool{background:transparent;font-size:inherit;margin:0;padding:0}#prettydiff #jserror span{display:block}#prettydiff #a11y{background:transparent;padding:0}#prettydiff #a11y div{margin:0.5em 0;border-style:solid;border-width:0.1em}#prettydiff #a11y h4{margin:0.25em 0}#prettydiff #a11y ol{border-style:solid;border-width:0.1em}#prettydiff #cssreport.doc table{clear:none;float:left;margin-left:1em}#prettydiff #css-size{left:24em}#prettydiff #css-uri{left:40em}#prettydiff #css-uri td{text-align:left}#prettydiff .report .analysis th{text-align:left}#prettydiff .report .analysis .parseData td{font-family:\"Courier New\",Courier,\"Lucida Console\",monospace;text-align:left;white-space:pre}#prettydiff .report .analysis td{text-align:right}#prettydiff .analysis{float:left;margin:0 1em 1em 0}#prettydiff .analysis td,#prettydiff .analysis th{padding:0.5em}#prettydiff #statreport div{border-style:none}#prettydiff .diff,#prettydiff .beautify{border-style:solid;border-width:0.1em;display:inline-block;margin:0 1em 1em 0;position:relative}#prettydiff .diff,#prettydiff .diff li #prettydiff .diff h3,#prettydiff .diff h4,#prettydiff .beautify,#prettydiff .beautify li,#prettydiff .beautify h3,#prettydiff .beautify h4{font-family:\"Courier New\",Courier,\"Lucida Console\",monospace}#prettydiff .diff li,#prettydiff .beautify li,#prettydiff .diff h3,#prettydiff .diff h4,#prettydiff .beautify h3,#prettydiff .beautify h4{border-style:none none solid none;border-width:0 0 0.1em 0;box-shadow:none;display:block;font-size:1.2em;margin:0 0 0 -.1em;padding:0.2em 2em;text-align:left}#prettydiff .diff .skip{border-style:none none solid;border-width:0 0 0.1em}#prettydiff .diff .diff-left{border-style:none;display:table-cell}#prettydiff .diff .diff-right{border-style:none none none solid;border-width:0 0 0 0.1em;display:table-cell;margin-left:-.1em;min-width:16.5em;right:0;top:0}#prettydiff .diff .data li,#prettydiff .beautify .data li{min-width:16.5em;padding:0.5em}#prettydiff .diff li,#prettydiff .diff p,#prettydiff .diff h3,#prettydiff .beautify li,#prettydiff .beautify p,#prettydiff .beautify h3{font-size:1.2em}#prettydiff .diff li em,#prettydiff .beautify li em{font-style:normal;font-weight:bold;margin:-0.5em -0.09em}#prettydiff .diff p.author{border-style:solid;border-width:0.2em 0.1em 0.1em;margin:0;overflow:hidden;padding:0.4em;text-align:right}#prettydiff .difflabel{display:block;height:0}#prettydiff .count{border-style:solid;border-width:0 0.1em 0 0;font-weight:normal;padding:0;text-align:right}#prettydiff .count li{padding:0.5em 1em;text-align:right}#prettydiff .count li.fold{cursor:pointer;font-weight:bold;padding-left:0.5em}#prettydiff .data{text-align:left;white-space:pre}#prettydiff .beautify .data em{display:inline-block;font-style:normal;font-weight:bold}#prettydiff .beautify li,#prettydiff .diff li{border-style:none none solid;border-width:0 0 0.1em;display:block;height:1em;line-height:1.2;list-style-type:none;margin:0;white-space:pre}#prettydiff .beautify ol,#prettydiff .diff ol{display:table-cell;margin:0;padding:0}#prettydiff .beautify em.l0,#prettydiff .beautify em.l1,#prettydiff .beautify em.l2,#prettydiff .beautify em.l3,#prettydiff .beautify em.l4,#prettydiff .beautify em.l5,#prettydiff .beautify em.l6,#prettydiff .beautify em.l7,#prettydiff .beautify em.l8,#prettydiff .beautify em.l9,#prettydiff .beautify em.l10,#prettydiff .beautify em.l11,#prettydiff .beautify em.l12,#prettydiff .beautify em.l13,#prettydiff .beautify em.l14,#prettydiff .beautify em.l15,#prettydiff .beautify em.l16{height:2.2em;margin:0 0 -1em;position:relative;top:-0.5em}#prettydiff .beautify em.l0{margin-left:-0.5em;padding-left:0.5em}#prettydiff #report .beautify,#prettydiff #report .beautify li,#prettydiff #report .diff,#prettydiff #report .diff li{font-family:\"Courier New\",Courier,\"Lucida Console\",monospace}#prettydiff #report .beautify{border-style:solid}#prettydiff #report .diff h3,#prettydiff #report .beautify h3{margin:0}#prettydiff{text-align:center;font-size:10px;overflow-y:scroll}#prettydiff .contentarea{border-style:solid;border-width:0.1em;font-family:\"Century Gothic\",\"Trebuchet MS\";margin:0 auto;max-width:93em;padding:1em;text-align:left}#prettydiff dd,#prettydiff dt,#prettydiff p,#prettydiff li,#prettydiff td,#prettydiff blockquote,#prettydiff th{clear:both;font-family:\"Palatino Linotype\",\"Book Antiqua\",Palatino,serif;font-size:1.6em;line-height:1.6em;text-align:left}#prettydiff blockquote{font-style:italic}#prettydiff dt{font-size:1.4em;font-weight:bold;line-height:inherit}#prettydiff li li,#prettydiff li p{font-size:1em}#prettydiff th,#prettydiff td{border-style:solid;border-width:0.1em;padding:0.1em 0.2em}#prettydiff td span{display:block}#prettydiff code,#prettydiff textarea{font-family:\"Courier New\",Courier,\"Lucida Console\",monospace}#prettydiff code,#prettydiff textarea{display:block;font-size:0.8em;width:100%}#prettydiff code span{display:block;white-space:pre}#prettydiff code{border-style:solid;border-width:0.2em;line-height:1em}#prettydiff textarea{line-height:1.4em}#prettydiff label{display:inline;font-size:1.4em}#prettydiff legend{border-radius:1em;border-style:solid;border-width:0.1em;font-size:1.4em;font-weight:bold;margin-left:-0.25em;padding:0 0.5em}#prettydiff fieldset fieldset legend{font-size:1.2em}#prettydiff table{border-collapse:collapse}#prettydiff div.report{border-style:none}#prettydiff h2,#prettydiff h3,#prettydiff h4{clear:both}#prettydiff table{margin:0 0 1em}#prettydiff .analysis .bad,#prettydiff .analysis .good{font-weight:bold}#prettydiff h1{font-size:3em;font-weight:normal;margin-top:0}#prettydiff h1 span{font-size:0.5em}#prettydiff h1 svg{border-style:solid;border-width:0.05em;float:left;height:1.5em;margin-right:0.5em;width:1.5em}#prettydiff h2{border-style:none;background:transparent;font-size:1em;box-shadow:none;margin:0}#prettydiff h2 button{background:transparent;border-style:solid;cursor:pointer;display:block;font-size:2.5em;font-weight:normal;text-align:left;width:100%;border-width:0.05em;font-weight:normal;margin:1em 0 0;padding:0.1em}#prettydiff h2 span{display:block;float:right;font-size:0.5em}#prettydiff h3{font-size:2em;margin:0;background:transparent;box-shadow:none;border-style:none}#prettydiff h4{font-size:1.6em;font-family:\"Century Gothic\",\"Trebuchet MS\";margin:0}#prettydiff li h4{font-size:1em}#prettydiff button,#prettydiff fieldset,#prettydiff div input,#prettydiff textarea{border-style:solid;border-width:0.1em}#prettydiff section{border-style:none}#prettydiff h2 button,#prettydiff select,#prettydiff option{font-family:inherit}#prettydiff select{border-style:inset;border-width:0.1em;width:13.5em}#prettydiff #dcolorScheme{float:right;margin:-3em 0 0}#prettydiff #dcolorScheme label,#prettydiff #dcolorScheme label{display:inline-block;font-size:1em}#prettydiff .clear{clear:both;display:block}#prettydiff caption,#prettydiff .content-hide{height:1em;left:-1000em;overflow:hidden;position:absolute;top:-1000em;width:1em}/*]]>*/</style></head><body id=\"prettydiff\" class=\"white\"><div class=\"contentarea\" id=\"report\"><section role=\"heading\"><h1><svg height=\"2000.000000pt\" id=\"pdlogo\" preserveAspectRatio=\"xMidYMid meet\" version=\"1.0\" viewBox=\"0 0 2000.000000 2000.000000\" width=\"2000.000000pt\" xmlns=\"http://www.w3.org/2000/svg\"><g fill=\"#999\" stroke=\"none\" transform=\"translate(0.000000,2000.000000) scale(0.100000,-0.100000)\"> <path d=\"M14871 18523 c-16 -64 -611 -2317 -946 -3588 -175 -660 -319 -1202 -320 -1204 -2 -2 -50 39 -107 91 -961 876 -2202 1358 -3498 1358 -1255 0 -2456 -451 -3409 -1279 -161 -140 -424 -408 -560 -571 -507 -607 -870 -1320 -1062 -2090 -58 -232 -386 -1479 -2309 -8759 -148 -563 -270 -1028 -270 -1033 0 -4 614 -8 1365 -8 l1364 0 10 38 c16 63 611 2316 946 3587 175 660 319 1202 320 1204 2 2 50 -39 107 -91 543 -495 1169 -862 1863 -1093 1707 -568 3581 -211 4965 946 252 210 554 524 767 796 111 143 312 445 408 613 229 406 408 854 525 1320 57 225 380 1451 2310 8759 148 563 270 1028 270 1033 0 4 -614 8 -1365 8 l-1364 0 -10 -37z m-4498 -5957 c477 -77 889 -256 1245 -542 523 -419 850 -998 954 -1689 18 -121 18 -549 0 -670 -80 -529 -279 -972 -612 -1359 -412 -480 -967 -779 -1625 -878 -121 -18 -549 -18 -670 0 -494 74 -918 255 -1283 548 -523 419 -850 998 -954 1689 -18 121 -18 549 0 670 104 691 431 1270 954 1689 365 293 828 490 1283 545 50 6 104 13 120 15 72 10 495 -3 588 -18z\"/></g></svg><a href=\"prettydiff.com.xhtml\">Pretty Diff</a></h1><p id=\"dcolorScheme\"><label class=\"label\" for=\"colorScheme\">Color Scheme</label><select id=\"colorScheme\"><option>Canvas</option><option>Shadow</option><option selected=\"selected\">White</option></select></p><p>Find <a href=\"https://github.com/prettydiff/prettydiff\">Pretty Diff on GitHub</a>.</p></section><section role=\"main\"><p><strong>Number of differences:</strong> <em>1</em> differences from <em>1</em> line of code.</p><div class='diff'><div class='diff-left'><h3 class='texttitle'>base</h3><ol class='count'><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li></ol><ol class=\"data\" data-prettydiff-ignore=\"true\"><li class=\"equal\">&lt;a&gt;&#10;</li><li class=\"equal\">    &lt;b&gt;&#10;</li><li class=\"replace\">        &lt;<em>c</em>/&gt;&#10;</li><li class=\"equal\">    &lt;/b&gt;&#10;</li><li class=\"equal\">&lt;/a&gt;&#10;</li></ol></div><div class='diff-right'><h3 class='texttitle'>new</h3><ol class='count' style='cursor:w-resize'><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li></ol><ol class=\"data\" data-prettydiff-ignore=\"true\"><li class=\"equal\">&lt;a&gt;&#10;</li><li class=\"equal\">    &lt;b&gt;&#10;</li><li class=\"replace\">        &lt;<em>d</em>/&gt;&#10;</li><li class=\"equal\">    &lt;/b&gt;&#10;</li><li class=\"equal\">&lt;/a&gt;&#10;</li></ol></div><p class=\"author\">Diff view written by <a href=\"http://prettydiff.com/\">Pretty Diff</a>.</p></div></section></div><script type=\"application/javascript\">//<![CDATA[\r\nvar pd={};pd.colorchange=function(){\"use strict\";var options=this.getElementsByTagName(\"option\");document.getElementsByTagName(\"body\")[0].setAttribute(\"class\",options[this.selectedIndex].innerHTML.toLowerCase())};pd.difffold=function dom__difffold(){\"use strict\";var a=0,b=0,self=this,title=self.getAttribute(\"title\").split(\"line \"),min=Number(title[1].substr(0,title[1].indexOf(\" \"))),max=Number(title[2]),inner=self.innerHTML,lists=[],parent=self.parentNode.parentNode,listnodes=(parent.getAttribute(\"class\")===\"diff\")?parent.getElementsByTagName(\"ol\"):parent.parentNode.getElementsByTagName(\"ol\"),listLen=listnodes.length;for(a=0;a<listLen;a+=1){lists.push(listnodes[a].getElementsByTagName(\"li\"))}max=(max>=lists[0].length)?lists[0].length:max;if(inner.charAt(0)===\"-\"){self.innerHTML=\"+\"+inner.substr(1);for(a=min;a<max;a+=1){for(b=0;b<listLen;b+=1){lists[b][a].style.display=\"none\"}}}else{self.innerHTML=\"-\"+inner.substr(1);for(a=min;a<max;a+=1){for(b=0;b<listLen;b+=1){lists[b][a].style.display=\"block\"}}}};pd.colSliderGrab=function(e){\"use strict\";var event=e||window.event,touch=(e!==null&&e.type===\"touchstart\"),node=this,diffRight=node.parentNode,diff=diffRight.parentNode,subOffset=0,lists=diff.getElementsByTagName(\"ol\"),counter=lists[0].clientWidth,data=lists[1].clientWidth,width=lists[2].parentNode.clientWidth,total=lists[2].parentNode.parentNode.clientWidth,offset=lists[2].parentNode.offsetLeft-lists[2].parentNode.parentNode.offsetLeft,min=((total-counter-data-2)-width),max=(total-width-counter),status=\"ew\",minAdjust=min+15,maxAdjust=max-15,withinRange=false,diffLeft=diffRight.previousSibling,drop=function dom__event_colSliderGrab_drop(f){f=f||window.event;f.preventDefault();node.style.cursor=status+\"-resize\";if(touch===true){document.ontouchmove=null;document.ontouchend=null}else{document.onmousemove=null;document.onmouseup=null}},boxmove=function dom__event_colSliderGrab_boxmove(f){f=f||window.event;f.preventDefault();if(touch===true){subOffset=offset-f.touches[0].clientX}else{subOffset=offset-f.clientX}if(subOffset>minAdjust&&subOffset<maxAdjust){withinRange=true}if(withinRange===true&&subOffset>maxAdjust){diffRight.style.width=((total-counter-2)/10)+\"em\";status=\"e\"}else if(withinRange===true&&subOffset<minAdjust){diffRight.style.width=((total-counter-data-2)/10)+\"em\";status=\"w\"}else if(subOffset<max&&subOffset>min){diffRight.style.width=((width+subOffset)/10)+\"em\";status=\"ew\"}if(touch===true){document.ontouchend=drop}else{document.onmouseup=drop}};event.preventDefault();if(typeof pd.data===\"object\"&&pd.data.node.report.code.box!==null){offset+=pd.data.node.report.code.box.offsetLeft;offset-=pd.data.node.report.code.body.scrollLeft}else{subOffset=(document.body.parentNode.scrollLeft>document.body.scrollLeft)?document.body.parentNode.scrollLeft:document.body.scrollLeft;offset-=subOffset}offset+=node.clientWidth;node.style.cursor=\"ew-resize\";diff.style.width=(total/10)+\"em\";diff.style.display=\"inline-block\";if(diffLeft.nodeType!==1){do{diffLeft=diffLeft.previousSibling}while(diffLeft.nodeType!==1)}diffLeft.style.display=\"block\";diffRight.style.width=(diffRight.clientWidth/10)+\"em\";diffRight.style.position=\"absolute\";if(touch===true){document.ontouchmove=boxmove;document.ontouchstart=false}else{document.onmousemove=boxmove;document.onmousedown=null}return false};(function(){\"use strict\";var lists=document.getElementById(\"prettydiff\").getElementsByTagName(\"ol\"),cells=lists[0].getElementsByTagName(\"li\"),len=cells.length,a=0;for(a=0;a<len;a+=1){if(cells[a].getAttribute(\"class\")===\"fold\"){cells[a].onclick=pd.difffold}}if(lists.length>3){lists[2].onmousedown=pd.colSliderGrab;lists[2].ontouchstart=pd.colSliderGrab}pd.colorscheme=document.getElementById(\"colorScheme\");pd.colorscheme.onchange=pd.colorchange}());//]]>\r\n</script></body></html>"
                                        }
                                    ]
                                }, {
                                    group: "simple file tests",
                                    units: [
                                        {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"file\" " +
                                                        "mode:\"beautify\"",
                                            name  : "Verify `readmethod:file` throws error on missing output option",
                                            verify: "Error: 'readmethod' is value 'file' and argument 'output' is empty"
                                        }, {
                                            check : "node api/node-local.js source:\"<a><b> <c/>    </b></a>\" readmethod:\"screen\" " +
                                                        "mode:\"diff\" diff:\"<a><b> <d/>    </b></a>\" diffcli:true",
                                            name  : "Test diffcli option",
                                            verify: "\nScreen input with 1 difference\n\nLine: 3\x1b[39m\n<a>\n    <b>\n\x1B[31m     " +
                                                        "   <\x1B[1mc\x1B[22m/>\x1B[39m\n\x1B[32m        <\x1B[1md\x1B[22m/>\x1B[39m\n   " +
                                                        " </b>\n</a>"
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa1.txt\" readmethod:\"filesc" +
                                                        "reen\" mode:\"diff\" diff:\"test/simulation/testa.txt\"",
                                            name  : "Source file is empty",
                                            verify: "Source file at - is \x1B[31mempty\x1B[39m but the diff file is not."
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"diff\" diff:\"test/simulation/testa1.txt\"",
                                            name  : "Diff file is empty",
                                            verify: "Diff file at - is \x1B[31mempty\x1B[39m but the source file is not."
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"diff\" diff:\"test/simulation/testa1.txt\" diffcli:\"true\"",
                                            name  : "Diff file is empty with diffcli option",
                                            verify: "Diff file at - is \x1B[31mempty\x1B[39m but the source file is not."
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"diff\" diff:\"test/simulation/testa.txt\"",
                                            name  : "Diff file and source file are same file, readmethod filescreen",
                                            verify: ""
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"file\" " +
                                                        "output:\"test/simulation\" mode:\"diff\" diff:\"test/simulation/testa.txt\"",
                                            name  : "Diff file and source file are same file, readmethod file",
                                            verify: "\nPretty Diff found 0 differences. Executed in."
                                        }
                                    ]
                                }, {
                                    group: "readmethod: filescreen",
                                    units: [
                                        {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"beautify\"",
                                            name  : "Beautify markup.",
                                            verify: "<a>\n    <b>\n        <c/>\n    </b>\n</a>"
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"minify\"",
                                            name  : "Minify markup.",
                                            verify: "<a><b> <c/> </b></a>"
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"parse\"",
                                            name  : "Parse markup.",
                                            verify: "{\"data\":{\"attrs\":[[],[],[],[],[]],\"jscom\":[false,false,false,false,false],\"linen\":[1,1,1,1,1],\"lines\":[0,0,1,1,0],\"presv\":[false,false,false,false,false],\"token\":[\"<a>\",\"<b>\",\"<c/>\",\"</b>\",\"</a>\"],\"types\":[\"start\",\"start\",\"singleton\",\"end\",\"end\"]},\"definition\":{\"attrs\":\"array - List of attributes (if any) for the given token\",\"jscom\":\"boolean - Whether the token is a JavaScript comment if in JSX format\",\"linen\":\"number - The line number in the original source where the token started, which is used for reporting and analysis\",\"lines\":\"number - Whether the token is preceeded any space and/or line breaks in the original code source\",\"presv\":\"boolean - Whether the token is preserved verbatim as found.  Useful for comments and HTML 'pre' tags.\",\"token\":\"string - The parsed code tokens\",\"types\":\"string - Data types of the tokens: cdata, comment, conditional, content, end, ignore, linepreserve, script, sgml, singleton, start, template, template_else, template_end, template_start, xml\"}}"
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"beautify\"",
                                            name  : "Beautify markup.",
                                            verify: "<a>\n    <b>\n        <c/>\n    </b>\n</a>"
                                        }, {
                                            check : "node api/node-local.js source:\"test/simulation/testa.txt\" readmethod:\"filescr" +
                                                        "een\" mode:\"minify\"",
                                            name  : "Minify markup.",
                                            verify: "<a><b> <c/> </b></a>"
                                        }
                                    ]
                                }, {
                                    group: "write to new locations",
                                    units: [
                                        {
                                            check : "node api/node-local.js source:\"inch.json\" readmethod:\"file\" mode:\"beautify" +
                                                    "\" output:\"test/simulation/inch\"",
                                            name  : "Beautify inch.json",
                                            verify: "\nFile successfully written.\n\nPretty Diff beautified x files. Executed in."
                                        }, {
                                            check : "node api/node-local.js source:\"api\" readmethod:\"directory\" mode:\"beautify\"" +
                                                        " output:\"test/simulation/api\"",
                                            name  : "Beautify api directory",
                                            verify: "\nPretty Diff beautified x files. Executed in."
                                        }, {
                                            check : "node api/node-local.js source:\"test\" readmethod:\"subdirectory\" mode:\"parse" +
                                                    "\" output:\"test/simulation/all/big\"",
                                            name  : "Subdirectory parse all prettydiff",
                                            verify: "\nPretty Diff parsed x files. Executed in."
                                        }
                                    ]
                                }, {
                                    group: "file system checks",
                                    units: [
                                        {
                                            check : "cat test/simulation/inch/inch.json",
                                            name  : "print out asdf/inch.json",
                                            verify: "{\n    \"files\": {\n        \"included\": [\"prettydiff.js\"]\n    }\n}"
                                        }, {
                                            check : "ls test/simulation/api",
                                            name  : "check for 3 files in api directory",
                                            verify: (path.sep === "\\")
                                                ? "dom.js\r\nnode-local.js\r\nprettydiff.wsf"
                                                : "dom.js\nnode-local.js\nprettydiff.wsf"
                                        }, {
                                            check : "cat test/simulation/all/big/today.js",
                                            name  : "check for a file in a subdirectory operation",
                                            verify: "{\"data\":{\"begin\":[0,0,0,0,0,0,0,0,0,0,0,0],\"depth\":[\"global\",\"global\",\"global\",\"global\",\"global\",\"global\",\"global\",\"global\",\"global\",\"global\",\"global\",\"global\"],\"lines\":[0,0,0,0,0,0,0,0,0,0,0,0],\"token\":[\"/*global exports*/\",\"var\",\"today\",\"=\",\"20999999\",\";\",\"exports\",\".\",\"date\",\"=\",\"today\",\";\"],\"types\":[\"comment\",\"word\",\"word\",\"operator\",\"literal\",\"separator\",\"word\",\"separator\",\"word\",\"operator\",\"word\",\"separator\"]},\"definition\":{\"begin\":\"number - The index where the current container starts\",\"depth\":\"string - The name of the current container\",\"lines\":\"number - Whether the token is preceeded any space and/or line breaks in the original code source\",\"token\":\"string - The parsed code tokens\",\"types\":\"string - Data types of the tokens: comment, comment-inline, end, literal, markup, operator, regex, separator, start, template, template_else, template_end, template_start, word\"}}"
                                        }, {
                                            check : "cat test/simulation/all/big/samples_correct/beautification_markup_comment.txt",
                                            name  : "check for a deeper file in a subdirectory operation",
                                            verify: "{\"data\":{\"attrs\":[[],[],[],[],[],[]],\"jscom\":[false,false,false,false,false,false],\"linen\":[1,2,3,3,3,4],\"lines\":[0,1,1,0,0,1],\"presv\":[false,true,false,false,false,false],\"token\":[\"<person>\",\"<!-- comment -->\",\"<name>\",\"bob\",\"</name>\",\"</person>\"],\"types\":[\"start\",\"comment\",\"start\",\"content\",\"end\",\"end\"]},\"definition\":{\"attrs\":\"array - List of attributes (if any) for the given token\",\"jscom\":\"boolean - Whether the token is a JavaScript comment if in JSX format\",\"linen\":\"number - The line number in the original source where the token started, which is used for reporting and analysis\",\"lines\":\"number - Whether the token is preceeded any space and/or line breaks in the original code source\",\"presv\":\"boolean - Whether the token is preserved verbatim as found.  Useful for comments and HTML 'pre' tags.\",\"token\":\"string - The parsed code tokens\",\"types\":\"string - Data types of the tokens: cdata, comment, conditional, content, end, ignore, linepreserve, script, sgml, singleton, start, template, template_else, template_end, template_start, xml\"}}"
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                    unitsort  = function taskrunner_simulations_unitsort(aa, bb) {
                        if (aa.group === undefined && bb.group !== undefined) {
                            return 1;
                        }
                        return -1;
                    },
                    slashfix  = function taskrunner_simulations_slashfix(command) {
                        var comchars = [],
                            a        = 0,
                            dirchar  = "\\",
                            output   = "";
                        if (path.sep === "/") {
                            return command;
                        }
                        if (path.sep !== "\\") {
                            dirchar = path.sep;
                        }
                        comchars = command.split("");
                        for (a = comchars.length - 1; a > -1; a -= 1) {
                            if (comchars[a] === "/" && comchars[a - 1] !== "<" && comchars[a + 1] !== ">") {
                                comchars[a] = dirchar;
                            }
                        }
                        output = comchars.join("");
                        if (dirchar === "\\") {
                            if (output.indexOf("node api/node-local.js") === 0) {
                                output = output + " crlf:\"true\"";
                            }
                            output = output.replace(/^(rm\ (-\w+\ )*)/, "rmdir /s /q ");
                            output = output.replace(/^(cat\ )/, "type ");
                            output = output.replace(/^(ls\ (-\w+\ )*)/, "dir /b ");
                        }
                        return output;
                    },
                    shell     = function taskrunner_simulations_shell(testData) {
                        var childExec = require("child_process").exec,
                            tab       = (function taskrunner_simulations_shell_child_writeLine_tab() {
                                var a   = 0,
                                    b   = 0,
                                    str = "";
                                for (a = depth + 2; a > 0; a -= 1) {
                                    for (b = tablen; b > 0; b -= 1) {
                                        str += " ";
                                    }
                                }
                                return str;
                            }()),
                            child     = function taskrunner_simulations_shell_child(param) {
                                param.check  = slashfix(param.check);
                                childExec(param.check, function taskrunner_simulations_shell_child_childExec(err, stdout, stderr) {
                                    var data      = [param.name],
                                        verifies  = function taskrunner_simulations_shell_child_childExec_verifies(output, list) {
                                            var aa  = 0,
                                                len = list.length;
                                            if (output === list[0]) {
                                                passcount[depth] += 1;
                                                data.push("pass");
                                                return data.push(stdout);
                                            }
                                            do {
                                                aa += 1;
                                                if (output === list[aa]) {
                                                    passcount[depth] += 1;
                                                    data.push("pass");
                                                    return data.push(stdout);
                                                }
                                            } while (aa < len);
                                            data.push("fail");
                                            data.push("Unexpected output:");
                                            diffFiles("phases.simulations", output, list);
                                        },
                                        //what to do when a group concludes
                                        writeLine = function taskrunner_simulations_shell_child_childExec_writeLine(item) {
                                            var fail          = 0,
                                                failper       = 0,
                                                plural        = "",
                                                groupn        = single
                                                    ? ""
                                                    : " for group: \x1B[39m\x1B[33m" + groupname[depth] + "\x1B[39m",
                                                totaln        = single
                                                    ? ""
                                                    : " in current group, " + total + " total",
                                                status        = (item[1] === "pass")
                                                    ? "\x1B[32mPass\x1B[39m test "
                                                    : "\x1B[31mFail\x1B[39m test ",
                                                groupComplete = function taskrunner_simulations_shell_child_childExec_writeLint_groupCompleteInit() {
                                                    return;
                                                },
                                                groupEnd      = function taskrunner_simulations_shell_child_childExec_writeLine_groupEnd() {
                                                    var groupPass = false;
                                                    if (teardowns[depth].length === 0) {
                                                        console.log("");
                                                    }
                                                    if (passcount[depth] === finished[depth]) {
                                                        if (grouplen[depth] === 1) {
                                                            console.log(tab.slice(tablen) + "\x1B[32mThe test passed" + groupn + "\x1B[39m");
                                                        } else {
                                                            console.log(tab.slice(tablen) + "\x1B[32mAll " + grouplen[depth] + " tests/groups passed" + groupn + "\x1B[39m");
                                                        }
                                                        groupPass = true;
                                                    } else {
                                                        if (passcount[depth] === 0) {
                                                            if (grouplen[depth] === 1) {
                                                                console.log(tab.slice(tablen) + "\x1B[31mThe test failed" + groupn + "\x1B[39m");
                                                            } else {
                                                                console.log(tab.slice(tablen) + "\x1B[31mAll " + grouplen[depth] + " tests/groups failed" + groupn + "\x1B[39m");
                                                            }
                                                        } else {
                                                            fgroup  += 1;
                                                            fail    = finished[depth] - passcount[depth];
                                                            failper = (fail / grouplen[depth]) * 100;
                                                            if (fail === 1) {
                                                                plural = "";
                                                            } else {
                                                                plural = "s";
                                                            }
                                                            console.log(tab.slice(tablen) + "\x1B[31m" + fail + "\x1B[39m test" + plural + " (" + failper.toFixed(0) + "%) failed of \x1B[32m" + finished[depth] + "\x1B[39m tests" + groupn + ".");
                                                        }
                                                    }
                                                    teardowns.pop();
                                                    grouplen.pop();
                                                    groupname.pop();
                                                    passcount.pop();
                                                    finished.pop();
                                                    units.pop();
                                                    index.pop();
                                                    depth -= 1;
                                                    if (depth > -1) {
                                                        tab             = tab.slice(tablen);
                                                        finished[depth] += 1;
                                                        groupn          = " for group: \x1B[39m\x1B[33m" + groupname[depth] + "\x1B[39m";
                                                        if (groupPass === true) {
                                                            passcount[depth] += 1;
                                                        }
                                                        if (finished[depth] < grouplen[depth]) {
                                                            index[depth] += 1;
                                                            if (units[depth][index].group !== undefined) {
                                                                taskrunner_simulations_shell(units[depth][index]);
                                                            } else {
                                                                taskrunner_simulations_shell_child(units[depth][index]);
                                                            }
                                                        }
                                                    } else {
                                                        console.log("");
                                                        console.log("All tests complete.");
                                                        plural = (total === 1)
                                                            ? ""
                                                            : "s";
                                                        totaln = (fails === 1)
                                                            ? ""
                                                            : "s";
                                                        groupn = (fgroup === 1)
                                                            ? ""
                                                            : "s";
                                                        status = (gcount === 1)
                                                            ? ""
                                                            : "s";
                                                        gcount -= 1;
                                                        if (fails === 0) {
                                                            console.log("\x1B[32mPassed all " + total + " test" + plural + " from all " + gcount + " groups.\x1B[39m");
                                                            console.log("");
                                                            console.log("\x1B[32mCLI simulation complete\x1B[39m");
                                                            return next();
                                                        }
                                                        if (fails === total) {
                                                            errout("\x1B[31mFailed all " + total + " test" + plural + " from all " + gcount + " groups.\x1B[39m");
                                                        } else {
                                                            // a hack, this should not increment when a test failure occurred in a child
                                                            // group
                                                            fgroup -= 1;
                                                            if (fgroup === 1) {
                                                                groupn = "";
                                                            }
                                                            errout("\x1B[31mFailed " + fails + " test" + totaln + " from " + fgroup + " group" + groupn + "\x1B[39m out of " + total + " total tests across " + gcount + " group" + status + ".");
                                                        }
                                                        return stdout;
                                                    }
                                                    if (depth > -1 && finished[depth] === grouplen[depth]) {
                                                        groupComplete();
                                                    }
                                                },
                                                teardown      = function taskrunner_simulations_shell_child_writeLine_teardown(tasks) {
                                                    var a    = 0,
                                                        len    = tasks.length,
                                                        task   = function taskrunner_simulations_shell_child_writeLine_teardown_task() {
                                                            var winerr = false,
                                                                execCallback = function taskrunner_simulations_shell_child_writeLine_teardown_task_exec(err, stdout, stderr) {
                                                                    a += 1;
                                                                    if (typeof err === "string") {
                                                                        console.log(err);
                                                                    } else if (typeof stderr === "string" && stderr !== "") {
                                                                        console.log(stderr);
                                                                        if (path.sep === "\\" && stderr.indexOf("The directory is not empty.") > 0) {
                                                                            winerr = true;
                                                                        }
                                                                    } else {
                                                                        if (a === len) {
                                                                            console.log(tab + "\x1B[36mTeardown\x1B[39m for group: \x1B[33m" + groupname[depth] + "\x1B[39m \x1B[32mcomplete\x1B[39m.");
                                                                            console.log("");
                                                                            groupEnd();
                                                                            return stdout;
                                                                        }
                                                                        taskrunner_simulations_shell_child_writeLine_teardown_task();
                                                                    }
                                                                };
                                                            tasks[a] = slashfix(tasks[a]);
                                                            console.log(tab + "  " + tasks[a]);
                                                            childExec(tasks[a], execCallback);
                                                            if (winerr === true) {
                                                                console.log("Async error in Windows file system.  Trying one more time...");
                                                                childExec(tasks[a], execCallback);
                                                            }
                                                        };
                                                    console.log("");
                                                    console.log(tab + "\x1B[36mTeardown\x1B[39m for group: \x1B[33m" + groupname[depth] + "\x1B[39m \x1B[36mstarted\x1B[39m.");
                                                    task();
                                                };
                                            groupComplete   = function taskrunner_simulations_shell_child_writeLine_groupComplete() {
                                                if (teardowns[depth].length > 0) {
                                                    teardown(teardowns[depth]);
                                                } else {
                                                    groupEnd();
                                                }
                                            };
                                            finished[depth] += 1;
                                            if (single === false && finished[depth] === 1) {
                                                if (depth === 0) {
                                                    console.log("");
                                                    console.log(tab.slice(tablen) + "\x1B[36mTest group: \x1B[39m\x1B[33m" + groupname[depth] + "\x1B[39m");
                                                } else {
                                                    console.log("");
                                                    console.log(tab.slice(tablen) + "Test unit " + (finished[depth - 1] + 1) + " of " + grouplen[depth - 1] + ", \x1B[36mtest group: \x1B[39m\x1B[33m" + groupname[depth] + "\x1B[39m");
                                                }
                                            }
                                            console.log(tab + item[0]);
                                            console.log(tab + status + finished[depth] + " of " + grouplen[depth] + totaln);
                                            if (item[1] !== "pass") {
                                                fails += 1;
                                                console.log(tab + item[2]);
                                            }
                                            if (finished[depth] === grouplen[depth]) {
                                                groupComplete();
                                            } else if (units[finished[depth]] !== undefined && units[finished[depth]].group !== undefined) {
                                                taskrunner_simulations_shell(units[finished[depth]]);
                                            }
                                        };
                                    stdout = stdout.replace(/(\s+)$/, "");
                                    stdout = stdout.replace(/<strong>Execution\ time:<\/strong>\ <em>([0-9]+\ hours\ )?([0-9]+\ minutes\ )?[0-9]+(\.[0-9]+)?\ seconds\ <\/em>/g, "<strong>Execution time:</strong> <em>0</em>");
                                    stdout = stdout.replace(/Executed\ in\ ([0-9]+\ hours\ )?([0-9]+\ minutes\ )?[0-9]+(\.[0-9]+)?\ seconds/g, "Executed in");
                                    stdout = stdout.replace(/\ \d+\ files?\./, " x files.");
                                    stdout = stdout.replace(/20\d{6}/, "20999999");
                                    //determine pass/fail status of a given test unit
                                    if (stdout.indexOf("Source file at ") > -1 && stdout.indexOf("is \x1B[31mempty\x1B[39m but the diff file is not.") > 0) {
                                        stdout = stdout.slice(0, stdout.indexOf("Source file at") + 14) + " - " + stdout.slice(stdout.indexOf("is \x1B[31mempty\x1B[39m but the diff file is not."));
                                    } else if (stdout.indexOf("Diff file at ") > -1 && stdout.indexOf("is \x1B[31mempty\x1B[39m but the source file is not.") > 0) {
                                        stdout = stdout.slice(0, stdout.indexOf("Diff file at") + 12) + " - " + stdout.slice(stdout.indexOf("is \x1B[31mempty\x1B[39m but the source file is not."));
                                    }
                                    if (stdout.indexOf("Pretty Diff found 0 differences.") < 0) {
                                        stdout = stdout.replace(/Pretty\ Diff\ found\ \d+\ differences./, "Pretty Diff found x differences.");
                                    }
                                    if (typeof err === "string") {
                                        data.push("fail");
                                        data.push(err);
                                    } else if (typeof stderr === "string" && stderr !== "") {
                                        data.push("fail");
                                        data.push(stderr);
                                    } else if (stdout !== param.verify) {
                                        if (typeof param.verify === "string" || param.verify.length === 0) {
                                            data.push("fail");
                                            data.push("Unexpected output:");
                                            diffFiles("phases.simulations", stdout, param.verify);
                                        } else {
                                            verifies(stdout, param.verify);
                                        }
                                    } else {
                                        passcount[depth] += 1;
                                        data.push("pass");
                                        data.push(stdout);
                                    }
                                    total += 1;
                                    writeLine(data);
                                });
                            },
                            buildup   = function taskrunner_simulations_shell_buildup(tasks) {
                                var a    = 0,
                                    len  = tasks.length,
                                    echo = [],
                                    task = function taskrunner_simulations_shell_buildup_task() {
                                        var buildstep = function taskrunner_simulations_shell_buildup_task_buildstep(err, stdout, stderr) {
                                            a += 1;
                                            if (typeof err === "string") {
                                                console.log("\x1B[31mError:\x1B[39m " + err);
                                                console.log("Terminated early");
                                            } else if (typeof stderr === "string" && stderr !== "") {
                                                console.log("\x1B[31mError:\x1B[39m " + stderr);
                                                console.log("Terminated early");
                                            } else {
                                                if (a < len) {
                                                    taskrunner_simulations_shell_buildup_task();
                                                } else {
                                                    console.log(tab + "\x1B[36mBuildup\x1B[39m for group: \x1B[33m" + testData.group + "\x1B[39m \x1B[32mcomplete\x1B[39m.");
                                                    if (index[depth] === 0 && units[depth][index[depth]].group !== undefined) {
                                                        taskrunner_simulations_shell(units[depth][index[depth]]);
                                                        return stdout;
                                                    }
                                                    for (index[depth] = index[depth]; index[depth] < grouplen[depth]; index[depth] += 1) {
                                                        if (units[depth][index[depth]].group === undefined) {
                                                            child(units[depth][index[depth]]);
                                                            if (units[depth][index[depth] + 1] !== undefined && units[depth][index[depth] + 1].group !== undefined) {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        };
                                        tasks[a] = slashfix(tasks[a]);
                                        console.log(tab + "  " + tasks[a]);
                                        if (path.sep === "\\" && (/^(echo\s+("|'))/).test(tasks[a]) === true) {
                                            //windows will write CLI strings to files including the containing quotes
                                            options.source = tasks[a];
                                            options.mode   = "parse";
                                            options.lang   = "javascript";
                                            echo           = prettydiff.api(options);
                                            fs.writeFile(echo.data.token.slice(3).join("").replace(/(x?;)$/, ""), echo.data.token[1].slice(1, echo.data.token[1].length - 1), buildstep);
                                        } else {
                                            childExec(tasks[a], buildstep);
                                        }
                                    };
                                console.log("");
                                console.log(tab + "\x1B[36mBuildup\x1B[39m for group: \x1B[33m" + testData.group + "\x1B[39m \x1B[36mstarted\x1B[39m.");
                                task();
                            };
                        passcount.push(0);
                        if (single === false) {
                            groupname.push(testData.group);
                            finished.push(0);
                            index.push(0);
                            gcount += 1;
                            depth  += 1;
                            units.push(testData.units);
                            units[depth].sort(unitsort);
                            grouplen.push(units[depth].length);
                            if (testData.teardown !== undefined && testData.teardown.length > 0) {
                                teardowns.push(testData.teardown);
                            } else {
                                teardowns.push([]);
                            }
                            if (testData.buildup !== undefined && testData.buildup.length > 0) {
                                buildup(testData.buildup);
                            } else if (index[depth] === 0 && units[depth][index[depth]].group !== undefined) {
                                taskrunner_simulations_shell(units[depth][index[depth]]);
                            } else {
                                for (index[depth] = index[depth]; index[depth] < grouplen[depth]; index[depth] += 1) {
                                    if (units[depth][index[depth]].group === undefined) {
                                        child(units[depth][index[depth]]);
                                        if (units[depth][index[depth] + 1] !== undefined && units[depth][index[depth] + 1].group !== undefined) {
                                            break;
                                        }
                                    }
                                }
                            }
                        } else {
                            grouplen.push(tests.length);
                            child(testData);
                        }
                    };
                console.log("");
                console.log("");
                console.log("\x1B[36mCLI simulation tests\x1B[39m");
                tests.sort(unitsort);
                if (tests[tests.length - 1].group === undefined) {
                    single = true;
                }
                tests.forEach(shell);
            }
        };
    next = function taskrunner_next() {
        var complete = function taskrunner_complete() {
            console.log("");
            console.log("All tasks complete... Exiting clean!");
            humantime();
            process.exit(0);
        };
        if (order.length < 1) {
            return complete();
        }
        phases[order[0]]();
        order.splice(0, 1);
    };
    next();
}());
