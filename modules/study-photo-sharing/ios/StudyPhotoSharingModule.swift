import ExpoModulesCore
import UIKit

public class StudyPhotoSharingModule: Module {
  private var sharingPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("StudyPhotoSharing")

    AsyncFunction("shareFiles") {
      (fileUris: [String], promise: Promise) in
      guard self.sharingPromise == nil else {
        throw StudyPhotoSharingError.sharingInProgress
      }

      guard !fileUris.isEmpty else {
        throw StudyPhotoSharingError.noFiles
      }

      guard
        let currentViewController =
          self.appContext?.utilities?.currentViewController()
      else {
        throw StudyPhotoSharingError.missingViewController
      }

      let fileUrls = try fileUris.map {
        try self.localFileUrl(from: $0)
      }
      let shareController = UIActivityViewController(
        activityItems: fileUrls,
        applicationActivities: nil
      )

      self.sharingPromise = promise
      shareController.completionWithItemsHandler = {
        _, completed, _, error in
        let currentPromise = self.sharingPromise

        self.sharingPromise = nil

        if let error {
          currentPromise?.reject(error)
          return
        }

        currentPromise?.resolve(["completed": completed])
      }

      if UIDevice.current.userInterfaceIdiom == .pad {
        shareController.popoverPresentationController?.sourceView =
          currentViewController.view
        shareController.popoverPresentationController?.sourceRect =
          CGRect(
            x: currentViewController.view.bounds.midX,
            y: currentViewController.view.bounds.midY,
            width: 0,
            height: 0
          )
        shareController.popoverPresentationController?
          .permittedArrowDirections = []
      }

      currentViewController.present(
        shareController,
        animated: true
      )
    }.runOnQueue(.main)
  }

  private func localFileUrl(from fileUri: String) throws -> URL {
    let fileUrl: URL

    if let parsedUrl = URL(string: fileUri), parsedUrl.isFileURL {
      fileUrl = parsedUrl
    } else if fileUri.hasPrefix("/") {
      fileUrl = URL(fileURLWithPath: fileUri)
    } else {
      throw StudyPhotoSharingError.invalidFileUri
    }

    guard FileManager.default.fileExists(atPath: fileUrl.path) else {
      throw StudyPhotoSharingError.fileNotFound
    }

    return fileUrl
  }
}

private enum StudyPhotoSharingError: Error {
  case sharingInProgress
  case noFiles
  case missingViewController
  case invalidFileUri
  case fileNotFound
}
