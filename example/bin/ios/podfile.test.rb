require 'minitest/autorun'
require 'ostruct'

module Pod
  module Executable
    def self.execute_command(*)
      'react_native_pods.rb'
    end
  end
  module Config
    def self.instance
      OpenStruct.new(installation_root: '/example/ios')
    end
  end
end

class PodfileContext
  attr_reader :install_hook

  def require(*) = true
  def platform(*) = nil
  def min_ios_version_supported = '15.1'
  def prepare_react_native_project! = nil
  def use_frameworks!(*) = nil
  def target(*) = yield
  def use_native_modules! = { reactNativePath: '/react-native' }
  def use_react_native!(*) = nil
  def react_native_post_install(*) = nil
  def post_install(&block)
    @install_hook = block
  end
end

class PodfileTest < Minitest::Test
  def test_all_pod_configurations_meet_the_react_native_minimum_without_lowering_newer_targets
    context = PodfileContext.new
    path = File.expand_path('../../ios/Podfile', __dir__)
    context.instance_eval(File.read(path), path)
    configurations = ['12.0', '15.0', '15.1', '16.0', nil].map do |version|
      OpenStruct.new(build_settings: { 'IPHONEOS_DEPLOYMENT_TARGET' => version })
    end
    installer = OpenStruct.new(pods_project: OpenStruct.new(targets: [OpenStruct.new(build_configurations: configurations)]))
    context.install_hook.call(installer)
    assert_equal ['15.1', '15.1', '15.1', '16.0', '15.1'], configurations.map { |item| item.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] }
  end

  def test_fmt_workaround_preserves_flags_is_idempotent_and_does_not_change_other_pods
    context = PodfileContext.new
    path = File.expand_path('../../ios/Podfile', __dir__)
    context.instance_eval(File.read(path), path)
    configs = [nil, '$(inherited) -DKEEP', ['$(inherited)', '-DKEEP']].map do |flags|
      OpenStruct.new(build_settings: { 'OTHER_CPLUSPLUSFLAGS' => flags, 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20' })
    end
    other = OpenStruct.new(build_settings: { 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20' })
    installer = OpenStruct.new(pods_project: OpenStruct.new(targets: [
      OpenStruct.new(name: 'fmt', build_configurations: configs),
      OpenStruct.new(name: 'React-Core', build_configurations: [other])
    ]))
    2.times { context.install_hook.call(installer) }
    configs.each do |config|
      assert_equal 'c++17', config.build_settings['CLANG_CXX_LANGUAGE_STANDARD']
      flags = config.build_settings['OTHER_CPLUSPLUSFLAGS']
      flags = flags.split if flags.is_a?(String)
      assert_equal 1, flags.count('-U__cpp_lib_is_constant_evaluated')
      assert_includes flags, '$(inherited)'
    end
    assert_includes configs[1].build_settings['OTHER_CPLUSPLUSFLAGS'], '-DKEEP'
    assert_includes configs[2].build_settings['OTHER_CPLUSPLUSFLAGS'], '-DKEEP'
    assert_equal 'c++20', other.build_settings['CLANG_CXX_LANGUAGE_STANDARD']
  end

end
