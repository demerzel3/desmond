var gulp = require('gulp');
var stylus = require('gulp-stylus');
var nib = require('nib');

gulp.task('style:compile', function () {
  gulp.src('./style/main.styl')
    .pipe(stylus({
      use: nib(),
      compress: false
    }))
    .pipe(gulp.dest('./client/css'));
});

gulp.task('watch', function() {
  gulp.watch(['./style/main.styl'], ['style:compile']);
});