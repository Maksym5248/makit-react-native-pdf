const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// SDK 55's generated AppDelegate predates the scene lifecycle required by iOS 27.
// This belongs to this example, not to the PDF library's consumer config plugin.
module.exports = function withIosScene(config) {
  config = withInfoPlist(config, config => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        }],
      },
    };
    return config;
  });
  return withAppDelegate(config, config => {
    const marker = '// Makit SDK 55 scene lifecycle';
    if (config.modResults.contents.includes(marker)) return config;
    const startup = /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?#endif/;
    if (config.modResults.language !== 'swift' || !startup.test(config.modResults.contents)) {
      throw new Error('The SDK 55 example AppDelegate template changed; review its scene lifecycle before prebuild.');
    }
    config.modResults.contents = 'import UIKit\n' + config.modResults.contents.replace(startup, marker) + `

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
    self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    for activity in connectionOptions.userActivities { self.scene(scene, continue: activity) }
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
      if let source = context.options.sourceApplication { options[.sourceApplication] = source }
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;
    return config;
  });
};
