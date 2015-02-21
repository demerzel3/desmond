var gulp = require('gulp');
var stylus = require('gulp-stylus');
var shell = require('gulp-shell');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var nib = require('nib');
var traceur = require('gulp-traceur');
var concat = require('gulp-concat');
var insert = require('gulp-insert');
var through = require('through2');

var paths = {
  source: {
    dir: './src/client',
    files: './src/client/**/*.js',
    viewsFiles: './src/client/views/**/*.html'
  },
  build: {
    mainModule: 'routing',
    dir: './build/client',
    files: './build/client/**/*.js'
  },
  dist: {
    dir: './client/js',
    file: './client/js/desmond.js',
    filename: 'desmond.js'
  }
};

gulp.task('js:compile', function() {
  return gulp.src(paths.source.files/*, {base: paths.source.dir}*/)
    // convert every ES6 source file to an AMD module
    .pipe(traceur({sourceMaps: 'inline', modules: 'amd'}))
    .pipe(sourcemaps.init({loadMaps: true}))
    // name modules after their filename
    .pipe(through.obj(function(file, enc, callback) {
      var moduleName = file.relative.match(/^([a-z_\/]+)\.js$/)[1];
      file.contents = new Buffer(String(file.contents).replace('define([', 'define("' + moduleName + '", ['));
      callback(null, file);
    }))
    // output intermediate build files (for debug purposes)
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.build.dir));
});

gulp.task('js:concat', ['js:compile'], function() {
  gulp.src(paths.build.files)
    .pipe(sourcemaps.init({loadMaps: true, debug: true}))
    .pipe(concat(paths.dist.filename))
    .pipe(insert.append('require(\'' + paths.build.mainModule + '\');'))
    .pipe(sourcemaps.write('.', {debug: true}))
    .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('js:uglify', ['js:concat'], function() {
  gulp.src(paths.dist.file)
    .pipe(rename('desmond.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('js:build', ['js:compile', 'js:concat', 'js:uglify']);

gulp.task('style:compile', function () {
  gulp.src('./style/main.styl')
    .pipe(stylus({
      use: nib(),
      compress: false
    }))
    .pipe(gulp.dest('./client/css'));
});

gulp.task('default', ['js:build', 'style:compile'], function() {
  gulp.watch(['./style/main.styl'], ['style:compile']);
  gulp.watch(['./src/client/**/*.js'], ['js:build']);
});