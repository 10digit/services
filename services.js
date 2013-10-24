angular.module('10digit.services', ['10digit.utils', '10digit.validation', '10digit.geo', 'ngGrid'])

.factory('ServicesConfig', function(){
    var config = {
        testMode: false,
        initialValues: {
            service: {

				number: '8084461375',
				signup: true,
				forward: true,
				forwardTo: '2342342344',
				not_only: true,
				btn: 2342442934,
				type: 'personal',
				phoneBill: [
					{url: 'http://www.google.com', foo: 'bar'}
				],
				old_carrier: {
					carrier: 'Verizon',
					account_number: 234234234,
					name_on_account: 'Calvin Froedge',
					pin: 2342,
					social_security: 2343,
					wireless: true,
					service_country: 'US',
					service_state: 'KY',
					service_zip: 42167,
					service_city: 'Tompkinsville',
					service_address: '181 Rowland Lane'
				}
            }
        }
    };
    return config;
})

.factory('Services',['ServicesConfig', '$ajax', function(Config, $ajax){
    var SERVICE_PARK = 1
      , SERVICE_FORWARD = 2;

    var serviceObj = {}

	if(Config.testMode){
		serviceObj = Config.initialValues.service;
	} else {
		serviceObj = {
			type: 'business',
			forward: true,
			service: SERVICE_FORWARD,
			old_carrier: {},
			phoneBill: {},
			signup: true
		}
	}

	function makeServiceOption(key, val){
		return {
			param: key,
			value: angular.copy(val)
		}
	}

	function prepare(service){
		service.options = [
			makeServiceOption('serviceType', service.type),
			makeServiceOption('number', service.number),
			makeServiceOption('btn', (service.btn) ? service.btn : service.number)
		];
		if(service.forwardTo){
			service.options.push(makeServiceOption('forwardTo', service.forwardTo));
			delete service.forward;
			delete service.forwardTo;
		}
		delete service.type;
		delete service.number;
		delete service.not_only;
		delete service.serviceType;
		delete service.$$hashKey;
		delete service.cancelled;
		delete service.btn;
		delete service.existing;
		delete service.signup;
	}
    var services = [];

    return {
        services: services,
        addService: function(opts){
            var service = angular.copy(serviceObj);
            if(opts && opts.signup === true){
                service.signup = true;
            }
            services.push(service);
        },
        constants: {park: SERVICE_PARK, forward: SERVICE_FORWARD},
	    prepareForServerSubmit: function(){
		    var submit = angular.copy(services);
		    for(var i=0;i<submit.length;i++){
			    prepare(submit[i]);
		    }
		    return submit;
	    },
	    load: function(opts){
			$ajax.run('members/me/services', {
				success: function(res, status){
					for(var i = 0;i<res.length;i++){
						service = {};
						var r = res[i];
						service.number = r.number;
						if(r.forward){
							service.forward = r.forward;
							service.forwardTo = r.forwardTo;
						}
						service.type = r.type;
						service.service = r.service;
						service.id = r.id;
						service.existing = true;
						services.push(service);
					}
				}
			});
	    },
	    finish: function(service, opts){
		    var submit = angular.copy(service);
		    prepare(submit);

		    $ajax.run('members/me/numbers',
			    {
				    data: submit,
				    method: 'POST',
				    success: function(res, status){
					    if(opts && opts.success){
						    opts.success(res, status);
					    }

                        if(opts && opts.error){
                            opts.error(res, status);
                        }
				    }
			    }
		    );
	    },
	    update: function(service, opts){
		    var submit = angular.copy(service);
		    prepare(submit);
		    $ajax.run('members/me/numbers/'+service.id, {
				    method : 'PUT',
			        success: function(res, status){
						if(opts.success) opts.success(res, status);
			        },
					error: function(res, status){
						if(opts.error) opts.error(res, status);
					}
		        }
		    );
	    },
	    remove: function(service){
		    if(!service.signup){
				$ajax.run('members/me/numbers/'+service.id, {
						method: 'DELETE',
						success: function(res, status){
							if(opts.success) opts.success(res, status);
						}
					}
				);
		    }
		    services.remove(service);
	    }
    }
}])

.controller('ServicesCtrl', ['$scope', '$attrs', 'Services', '$rootScope', function($scope, $attrs, Services, $rootScope){
    $scope.services = Services.services;

    $scope.$watch('services', function(newV, oldV){
        if(newV.length != oldV.length){
           $rootScope.$broadcast('services_changed', $scope.services);
        }
    }, true);

	$scope.addService = function(){
		Services.addService({signup:true});
	}

	if(!$scope.signup){
		Services.load();
	}
}])

.controller('ServiceCtrl', ['$scope', '$rootScope', 'Services', 'ModalInstanceService', '$ajax', function($scope, $rootScope, Services, Modal, $ajax){
	var service = $scope.service;

	$scope.title = function(){
		return (service.number) ? service.number : 'New Number';
	}

	$scope.filepickerCallback = function(data){
		service.phoneBill = data;
		$scope.$apply();
	}

	var gridData = [];
	$scope.gridData = gridData;
	var calls = false;
	$scope.$watch('service.id', function(val){
		if(calls) return false;
		if(!$scope.signup){
			$ajax.run('members/me/calls', {
				success:function(res, status){
					for(var i=0;i<res.length;i++){
						var r = res[i];
						gridData.push({
							from: r['call_from'],
							duration: r.duration,
							start: r.start,
							end: r.end,
						});
					}
					calls = true;
				}
			});
		}
	}, true);
	$scope.gridOptions = {data: 'gridData'};


	$scope.$watch('service.forward', function(forward){
		if(forward){
			service.service = Services.constants.forward;
		} else {
			service.service = Services.constants.park;
		}
	}, true);

	$scope.$watch('service.cancelled', function(cancelled){
		if(cancelled){
			Modal.open({
				templateUrl: 'default_modal.html',
				resolve: {
					content: function(){
						return "<p>Unfortunately, we can't transfer your number into our system if you've already cancelled service with your existing provider.  If you first reinstate service, then we can port your number in.</p>";
					},
					title: function(){
						return '<p>We cannot service this number!</p>';
					}
				}
			});
		}
	}, true);

	$scope.$watch('service.number', function(data){
		if(data){
			$rootScope.$broadcast('services_changed', Services.services);
		}
	}, true);

	$scope.$watch('service.service', function(val){
		//notify service change
		$rootScope.$broadcast('services_changed', Services.services);
	}, true);

	$scope.$watch('service.type', function(val){
		//notify service change
		$rootScope.$broadcast('services_changed', Services.services);
	}, true);

	$scope.$watch('service.forward', function(val){
		//notify service change
		$rootScope.$broadcast('services_changed', Services.services);
	}, true);

	$scope.update = function(){
		Services.update(service,
			{
				success: function(){
					$scope.success = "Service updated successfully.";
				}
			}
		);
	}

	$scope.remove = function(){
		Services.remove(service,
			{
				success: function(res, status){
					$scope.$parent.success = "Number successfully removed.";
					$scope.$parent.$apply();
				}
			}
		);
	}

	$scope.finish = function(){
        var modal = Modal.open({
            scope: $scope,
            resolve: {
                title: function(){ return 'Creating New Service'; },
                content: function(){ return 'Just a moment...';},
                hideOk: function(){ return true;},
                okText: function(){ return 'ACCEPT';}
            }
        });

        modal.result.then(function(){
        });

		Services.finish(service,
			{
				success: function(res, status){
                    console.log($scope, modal);
					$scope.success = "Successfully added number.";
                    service.signup = undefined;
                    modal.close();
				},
                error: function(res, status){
                    $scope.error = "Sorry, we could not add the number!  Please contact customer service.";
                    modal.close();
                }
			}
		);
	}
}])

.directive('services', function () {
  return {
    restrict:'E',
    controller:'ServicesCtrl',
    templateUrl: 'template/10digit/services.html',
  };
}); 
