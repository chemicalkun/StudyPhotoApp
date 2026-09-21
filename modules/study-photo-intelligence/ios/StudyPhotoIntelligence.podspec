Pod::Spec.new do |s|
  s.name             = 'StudyPhotoIntelligence'
  s.version          = '1.0.0'
  s.summary          = 'On-device lecture summaries for StudyPhoto.'
  s.description      = 'Summarizes lecture OCR text on-device with Apple Foundation Models.'
  s.license          = { :type => 'MIT' }
  s.author           = 'StudyPhoto'
  s.homepage         = 'https://github.com/chemicalkun/StudyPhotoApp'
  s.platforms        = { :ios => '15.1' }
  s.swift_version    = '5.9'
  s.source           = { :git => 'https://github.com/chemicalkun/StudyPhotoApp.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'

  s.source_files = '**/*.{h,m,swift}'
end
