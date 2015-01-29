$puppetModulesInstaller = <<EOF
  mkdir -p /etc/puppet/modules
  (puppet module list | grep puppetlabs-apache) || puppet module install -v 1.2.0 puppetlabs-apache
EOF

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.hostname = "dev-desmond"
  config.vm.network :private_network, ip: "172.22.22.100"

  config.vm.provider "virtualbox" do |v|
    v.memory = 2048
    v.cpus = 4
    v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
  end

  config.vm.synced_folder ".", "/vagrant/", type: "rsync",
    rsync__args: ["--chmod=Du=rwx,Dg=rx,Do=rx,Fu=rw,Fg=r,Fo=r", "--verbose", "--archive", "--delete", "-z"]

  config.vm.provision :shell do |shell|
    shell.inline = $puppetModulesInstaller
  end

  config.vm.provision "puppet" do |puppet|
    puppet.manifests_path = "vagrant/manifests"
    puppet.options = "--verbose"
  end
end