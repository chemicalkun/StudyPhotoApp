Pod::Spec.new do |s|
  s.name             = 'StudyPhotoVision'
  s.version          = '1.0.0'
  s.summary          = 'On-device text recognition for StudyPhoto.'
  s.description      = 'Recognizes timetable text on-device with Apple Vision.'
  s.license          = { :type => 'MIT' }
  s.author           = 'StudyPhoto'
  s.homepage         = 'https://github.com/chemicalkun/StudyPhotoApp'
  s.platforms        = { :ios => '15.1' }
  s.swift_version    = '5.9'
  s.source           = { :git => 'https://github.com/chemicalkun/StudyPhotoApp.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end
