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
    dir: './src/',
    files: ['./src/**/*.js'],
    clientFiles: ['./src/client/**/*.js'],
    angularFiles: ['./src/angular2/**/*.js'],
    viewsFiles: './src/client/views/**/*.html'
  },
  build: {
    mainModule: 'routing',
    dir: './client/build',
    files: './build/**/*.js'
  },
  dist: {
    dir: './client/js',
    file: './client/js/desmond.js',
    filename: 'desmond.js'
  }
};

gulp.task('angular:clean-src', function(cb) {
  del(['./src/angular2'], cb);
});

gulp.task('angular:clean-build', function(cb) {
  del([paths.build.dir + '/angular2'], cb);
});

gulp.task('angular:copy-to-src', ['angular:clean-src'], function() {
  return gulp.src('./node_modules/angular2/es6/prod/**/*.es6', {base: './node_modules/angular2/es6/prod/'})
    .pipe(rename(function(file) {
      file.extname = file.extname.replace('.es6', '.js');
    }))
    .pipe(gulp.dest('./src/angular2'));
});

gulp.task('angular:compile', ['angular:copy-to-src', 'angular:clean-build'], function() {
  return gulp.src(paths.source.angularFiles, {base: paths.source.dir})
    // convert every ES6 source file to a System.js module
    .pipe(traceur({sourceMaps: 'inline', modules: 'instantiate'}))
    .pipe(sourcemaps.init({loadMaps: true}))
    // output built files
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.build.dir));
});

gulp.task('angular:update', ['angular:compile']);

gulp.task('js:clean', function(cb) {
  del([paths.build.dir + '/client'], cb);
});

gulp.task('js:compile', ['js:clean'], function() {
  return gulp.src(paths.source.clientFiles, {base: paths.source.dir})
    // convert every ES6 source file to a System.js module
    .pipe(traceur({sourceMaps: 'inline', modules: 'instantiate'}))
    .pipe(sourcemaps.init({loadMaps: true}))
    // output built files
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.build.dir));
});

/*
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
*/

gulp.task('js:build', ['js:compile', 'js:concat', 'js:uglify']);

gulp.task('style:clean', function(cb) {
  del([paths.build.dir + '/style'], cb);
});

gulp.task('style:compile', ['style:clean'], function() {
  return gulp.src('./style/main.styl')
    .pipe(stylus({
      use: nib(),
      compress: false
    }))
    .pipe(gulp.dest(paths.build.dir + '/style'));
});

gulp.task('default', ['angular:update', 'js:compile', 'style:compile'], function() {
  gulp.watch(['./style/main.styl'], ['style:compile']);
  gulp.watch([paths.source.clientFiles], ['js:compile']);
});