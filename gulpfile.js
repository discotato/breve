var gulp = require('gulp');
var sass = require('gulp-sass');
var prefixer = require('gulp-autoprefixer');
var minify = require('gulp-minify-css');

gulp.task('default', ['sass']); //tasks which are run are listed in this array
gulp.task('sass', function(){
	gulp
		.src('./static/main.scss')
		.pipe(sass())
		.pipe(prefixer())
		.pipe(gulp.dest('./static'));
	
	//gulp.pipe(sass())
});