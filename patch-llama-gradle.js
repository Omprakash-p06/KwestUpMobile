const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules/llama.rn/android/build.gradle');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Replace:
  // if (isNewArchitectureEnabled()) {
  //   apply plugin: "com.facebook.react"
  // }
  // with:
  // apply plugin: "com.facebook.react"
  const pattern1 = /if\s*\(\s*isNewArchitectureEnabled\(\)\s*\)\s*\{\s*apply\s+plugin:\s+["']com\.facebook\.react["']\s*\}/g;
  content = content.replace(pattern1, 'apply plugin: "com.facebook.react"');

  // Replace the second instance:
  // if (isNewArchitectureEnabled()) {
  //   react {
  //     jsRootDir = file("../src/")
  //     libraryName = "RNLlama"
  //     codegenJavaPackageName = "com.rnllama"
  //   }
  // }
  // with:
  // react {
  //   jsRootDir = file("../src/")
  //   libraryName = "RNLlama"
  //   codegenJavaPackageName = "com.rnllama"
  // }
  const pattern2 = /if\s*\(\s*isNewArchitectureEnabled\(\)\s*\)\s*\{\s*react\s*\{([\s\S]*?)\}\s*\}/g;
  content = content.replace(pattern2, 'react {$1}');

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Successfully patched llama.rn build.gradle for old architecture support.');
} else {
  console.warn('Target file not found: ' + targetFile);
}
