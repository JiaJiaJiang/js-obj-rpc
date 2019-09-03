var gulp = require('gulp');

var dist='./dist';

//js
function transjs(name,cover=90){
	var browserify = require('browserify'),
		buffer = require('vinyl-buffer'),
		source = require('vinyl-source-stream'),
		sourcemaps = require('gulp-sourcemaps'),
		rename = require('gulp-rename');

	console.log(`compiling ${name} covers ${cover}% browsers`);

	return browserify({
			entries: name,
			basedir:'./',
			debug: true,
			// sourceType: 'module'
		})
		.transform(
			"babelify",{
				presets: [
					[
						"@babel/preset-env",{
							"targets":{ 
								"browsers":`cover ${cover}%`
							},
							"debug": true,
							"corejs":3,
							"useBuiltIns": 'usage'
						}
					],
				],
			}
		)
		.bundle()
		.pipe(source(`./${name}`))
		.pipe(buffer())
		.pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest(dist));
}

gulp.task('build',function(){
	return transjs('rpc.js');
	/* let buffer = require('vinyl-buffer'),
		source = require('vinyl-source-stream'),
		babelify = require('babelify'),
		browserify = require('browserify'),
		composer = require('gulp-uglify/composer'),
		uglifyes = require('uglify-es'),
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
		.pipe(gulp.dest('./dist')); */
});

gulp.task('default',gulp.series('build'));
