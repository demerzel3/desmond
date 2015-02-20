var gulp = require('gulp');
var stylus = require('gulp-stylus');
var shell = require('gulp-shell');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var nib = require('nib');
var path = require('path');
var vinylPaths = require('vinyl-paths');

var paths = {
  clientSrcRoot: path.resolve('./src/client/'),
  mainFile: './src/client/routing.js',
  buildFile: './src/client/desmond.js',
  buildFileMap: './src/client/desmond.map'
};

/**
 * gulp has no support for single file traceur output, I had to use the command directly.
 * @see https://github.com/google/traceur-compiler/issues/1626
 */
gulp.task('traceur:compile', function () {
  return gulp.src(paths.mainFile, {read: false})
    .pipe(shell(['traceur --modules inline --source-maps file --source-root "'+paths.clientSrcRoot+'" --module "<%= file.path %>" --out '+paths.buildFile]));
});

gulp.task('uglify', ['traceur:compile'], function() {
  gulp.src(paths.buildFile)
    .pipe(rename('desmond.min.js'))
    .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(uglify())
    .pipe(sourcemaps.write({sourceRoot: '/src'}))
    .pipe(gulp.dest('./client/app'));
});

gulp.task('build:clean', ['traceur:compile', 'uglify'], function() {
  gulp.src([paths.buildFile, paths.buildFileMap])
    .pipe(vinylPaths(del));
});

gulp.task('build', ['traceur:compile', 'uglify', 'build:clean']);

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
  gulp.watch(['./src/client/**/*.js', '!'+paths.buildFile], ['build']);
});