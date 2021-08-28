var gulp = require('gulp');

var dist='./dist';

function transjs(name,cover=80){
	var browserify = require('browserify'),
		buffer = require('vinyl-buffer'),
		source = require('vinyl-source-stream'),
		sourcemaps = require('gulp-sourcemaps'),
		babel = require('gulp-babel');

	console.log(`compiling ${name} covers ${cover}% browsers`);

	return browserify({
			entries: name,
			basedir:'./',
			debug: true,
		})
		.transform(
			"babelify",{
				presets: [
					[
						"@babel/preset-env",{
							"targets":{ 
								"browsers":`cover ${cover}%`
							},
							"debug": false,
							"corejs":3,
							"useBuiltIns": 'usage'
						}
					],
				],
				plugins: [
					["@babel/plugin-proposal-class-properties"]
				]
			}
		)
		.bundle()
		.pipe(source(`./${name}`))
		.pipe(buffer())
		.pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(babel({
			presets:[
				["minify", {
					mangle:false,
				}],
			],
			plugins:[
				"babel-plugin-remove-comments",
			]
		}))
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest(dist));
}

gulp.task('build',function(){
	return transjs('rpc.js');
});

gulp.task('default',gulp.series('build'));
