exec { "apt-get update":
  path => "/usr/bin",
}

package { 'vim':
  ensure => present,
}

class { 'apache':
  default_vhost => false
}

apache::vhost { 'dev.desmondbudget.com':
  port    => '80',
  docroot => '/vagrant/client',
  docroot_group => 'vagrant',
  docroot_owner => 'vagrant'
}