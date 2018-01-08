/// <reference path="health.service.ts"/>
/// <reference path="health.ts"/>

namespace SpringBoot {

  export class HealthController {

    health: Health;
    promise: ng.IPromise<any>;

    constructor(private $interval: ng.IIntervalService, private healthService: HealthService) {
      'ngInject';
    }

    $onInit() {
      this.loadData();
      this.promise = this.$interval(() => this.loadData(), 10000);
    }

    $onDestroy() {
      this.$interval.cancel(this.promise);
    }

    loadData(): void {
      log.debug('Load health data');
      this.healthService.getHealth()
        .then(health => this.health = health);
    }

    getStatusIcon() {
      switch (this.health.status) {
        case 'UP':
          return 'pficon-ok'
        case 'FATAL':
          return 'pficon-error-circle-o'
        default:
          return 'pficon-info';
      }
    }

    getStatusClass() {
      switch (this.health.status) {
        case 'UP':
          return 'alert-success'
        case 'FATAL':
          return 'alert-danger'
        default:
          return 'alert-info';
      }
    }
    
  }

  export const healthComponent: angular.IComponentOptions = {
    template: `
      <div class="spring-boot-health-main">
        <h1>Health</h1>
        <div class="cards-pf" ng-if="$ctrl.health">
          <div class="container-fluid container-cards-pf">
            <div class="row row-cards-pf">
              <div class="col-lg-12">
                <div class="toast-pf alert" ng-class="$ctrl.getStatusClass()">
                  <span class="pficon" ng-class="$ctrl.getStatusIcon()"></span>
                  <strong>{{$ctrl.health.status}}</strong>
                </div>
              </div>
              <div class="col-xs-12 col-sm-6 col-md-4 col-lg-3" ng-repeat="item in $ctrl.health.items">
                <pf-info-status-card status="item"></pf-info-status-card>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    controller: HealthController
  }

}