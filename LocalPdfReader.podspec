require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'LocalPdfReader'
  s.version = package['version']
  s.summary = package['description']
  s.homepage = 'https://github.com/Maksym5248/makit-react-native-pdf'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'Ammo contributors; native renderer derived from Wonday'
  s.source = { :git => 'https://github.com/Maksym5248/makit-react-native-pdf.git', :tag => s.version }
  s.platforms = { :ios => '15.1' }
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.framework = 'PDFKit'
  s.requires_arc = true
  install_modules_dependencies(s)
end
