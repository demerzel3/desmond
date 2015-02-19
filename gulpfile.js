var gulp = require('gulp');
var stylus = require('gulp-stylus');
var shell = require('gulp-shell');
var rename = require('gulp-rename');
var del = require('del');
var nib = require('nib');

/**
 * gulp has no support for single file traceur output, I had to use the command directly.
 * @see https://github.com/google/traceur-compiler/issues/1626
 */
gulp.task('traceur:compile', function () {
  return gulp.src(['./client/app/routing.js'], {read: false})
    .pipe(shell(['traceur --modules inline --module "<%= file.path %>" --out ./client/app/build.js']));
});

gulp.task('build:move', ['traceur:compile'], function() {
  return gulp.src(['./client/app/build.js'])
    .pipe(rename('app.js'))
    .pipe(gulp.dest('./client/build'));
});

gulp.task('build:clean', ['build:move'], function() {
  del('./client/app/build.js');
});

gulp.task('build', ['traceur:compile', 'build:move', 'build:clean']);

gulp.task('style:compile', function () {
  gulp.src('./style/main.styl')
    .pipe(stylus({
      use: nib(),
      compress: false
    }))
    .pipe(gulp.dest('./client/css'));
});

gulp.task('default', ['build', 'style:compile'], function() {
  gulp.watch(['./style/main.styl'], ['style:compile']);
  gulp.watch(['./client/app/**/*.js'], ['build']);
});