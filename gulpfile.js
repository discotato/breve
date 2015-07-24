var gulp = require('gulp');
var sass = require('gulp-sass');
var prefixer = require('gulp-autoprefixer');
var minify = require('gulp-minify-css');

gulp.task('default', ['sass']);
gulp.task('sass', function(){
	gulp.pipe(sass())
});