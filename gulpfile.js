var gulp = require('gulp');

gulp.task('build',function(){
	let buffer = require('vinyl-buffer'),
		source = require('vinyl-source-stream'),
		babelify = require('babelify'),
		browserify = require('browserify'),
		rename = require('gulp-rename'),
		composer = require('gulp-uglify/composer'),
		uglifyes = require('uglify-es'),
		uglify = composer(uglifyes, console),
		options = {
			mangle: true,
			compress: {
				sequences: true,
				conditionals: true,
				dead_code: true,
				join_vars: true,
				comparisons:true,
				evaluate:true,
			}
		};

	return browserify({
			entries: 'rpc.js',
			basedir:'./',
			debug: true,
		}).transform(
			babelify.configure({
				presets: ['stage-0',`es2015`],
				plugins: ["transform-es2015-modules-commonjs"]
			})
		)
		.bundle()
		.pipe(source(`./rpc.js`))
		.pipe(buffer())
		//.pipe(uglify(options))
		.on('error',function(e){
			console.error(e);
		})
		//.pipe(rename('rpc.js'))
		.pipe(gulp.dest('./dist'));
});

gulp.task('default',['build']);
