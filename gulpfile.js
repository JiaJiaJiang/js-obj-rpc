var gulp = require('gulp');

var dist='./dist';

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
				plugins: [
					["@babel/plugin-proposal-class-properties", { "loose": true }]
				]
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
});

gulp.task('default',gulp.series('build'));
