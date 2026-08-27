import ExpoModulesCore
import ImageIO
import Vision

public class StudyPhotoVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StudyPhotoVision")

    AsyncFunction("recognizeText") { (imageUri: String, promise: Promise) in
      do {
        let imageUrl = try self.localImageUrl(from: imageUri)

        guard
          let imageSource = CGImageSourceCreateWithURL(
            imageUrl as CFURL,
            nil
          ),
          let image = CGImageSourceCreateImageAtIndex(
            imageSource,
            0,
            nil
          )
        else {
          throw StudyPhotoVisionError.imageCouldNotBeRead
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ja-JP", "en-US"]
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(
          cgImage: image,
          orientation: self.imageOrientation(for: imageSource),
          options: [:]
        )

        try handler.perform([request])

        let recognizedBlocks = (request.results ?? []).compactMap {
          observation -> [String: Any]? in
          guard let candidate = observation.topCandidates(1).first else {
            return nil
          }

          let boundingBox = observation.boundingBox

          return [
            "text": candidate.string,
            "confidence": Double(candidate.confidence),
            "boundingBox": [
              "x": Double(boundingBox.origin.x),
              "y": Double(boundingBox.origin.y),
              "width": Double(boundingBox.size.width),
              "height": Double(boundingBox.size.height)
            ]
          ]
        }

        promise.resolve(recognizedBlocks)
      } catch {
        promise.reject(error)
      }
    }
  }

  private func localImageUrl(from imageUri: String) throws -> URL {
    if
      let url = URL(string: imageUri),
      url.isFileURL
    {
      return url
    }

    if imageUri.hasPrefix("/") {
      return URL(fileURLWithPath: imageUri)
    }

    throw StudyPhotoVisionError.invalidImageUri
  }

  private func imageOrientation(
    for imageSource: CGImageSource
  ) -> CGImagePropertyOrientation {
    let properties = CGImageSourceCopyPropertiesAtIndex(
      imageSource,
      0,
      nil
    ) as? [CFString: Any]

    let rawValue = (
      properties?[kCGImagePropertyOrientation] as? NSNumber
    )?.uint32Value ?? 1

    return CGImagePropertyOrientation(rawValue: rawValue) ?? .up
  }
}

private enum StudyPhotoVisionError: Error {
  case invalidImageUri
  case imageCouldNotBeRead
}
