/// <reference path="feature.ts"/>
/// <reference path="features.service.ts"/>

namespace Karaf {

  export class FeaturesController {

    private static FILTER_FUNCTIONS = {
      state: (features, state) => features.filter(feature => feature.installed === (state === 'Installed' ? true : false)),
      name: (features, name) => {
        let regExp = new RegExp(name, 'i');
        return features.filter(feature => regExp.test(feature.name));
      },
      repository: (features, repositoryName) => {
        return features.filter(feature => feature.repositoryName === repositoryName)
      }
    };

    private features: Feature[] = [];

    private repositories: FeatureRepository[];

    private repositoryFilterValues: string[] = [];

    listConfig = {
      showSelectBox: false,
      useExpandingRows: false,
      updateInProgress: false
    };

    loading = true;

    listItems = null;

    private readonly installButton = {
      name: 'Install',
      actionFn: (action, item) => {
        Core.notification('info', `Installing feature ${item.name}`);

        this.listConfig.updateInProgress = true;
        this.featuresService.installFeature(item)
          .then(() => {
            Core.notification('success', `Installed feature ${item.name}`);
            this.loadFeatureRepositories();
            this.listConfig.updateInProgress = false;
          })
          .catch(error => {
            Core.notification('danger', error)
            this.listConfig.updateInProgress = true;
          });
      },
      selectedId: null
    };

    private readonly uninstallButton = {
      name: 'Uninstall',
      actionFn: (action, item) => {
        Core.notification('info', `Uninstalling feature ${item.name}`);

        this.listConfig.updateInProgress = true;
        this.featuresService.uninstallFeature(item)
          .then(() => {
            Core.notification('success', `Uninstalled feature ${item.name}`);
            this.loadFeatureRepositories();
            this.listConfig.updateInProgress = false;
          })
          .catch(error => {
            Core.notification('danger', error)
            this.listConfig.updateInProgress = false;
          });
      },
      selectedId: null
    };

    listItemActionButtons = this.itemActionButtons();

    private readonly addRepositoryAction = {
      name: 'Add repository',
      actionFn: action => {
        this.$uibModal.open({
          component: 'featureRepositoryAddModal'
        })
          .result.then((repository: any) => {
            if (repository.uri && repository.uri.trim().length > 0) {
              let repositoryMatch:FeatureRepository = this.repositories.filter(match => match.uri === repository.uri.trim())[0]
              if (repositoryMatch) {
                Core.notification('warning',`Feature repository ${repositoryMatch.uri} is already installed`);
              } else {
                Core.notification('info', `Adding feature repository ${repository.uri}`);
                this.featuresService.addFeatureRepository(repository.uri)
                .then(() => {
                  Core.notification('success', `Added feature repository ${repository.uri}`);
                  this.loadFeatureRepositories();
                })
                .catch(error => Core.notification('danger', error));
              }
            }
          });
      }
    };

    private readonly removeRepositoryAction = {
      name: 'Remove repository',
      actionFn: action => {
        this.$uibModal.open({
          component: 'featureRepositoryRemoveModal',
          resolve: {repositories: () => {return this.repositories}}
        })
          .result.then((selectedRepository: FeatureRepository) => {
            if (selectedRepository) {
              let dependentRepositories = [];

              angular.forEach(this.repositories, repository => {
                if (repository.name !== selectedRepository.name) {
                  angular.forEach(repository.dependencies, dependency => {
                    if (dependency === selectedRepository.uri) {
                      dependentRepositories.push(repository.name);
                    }
                  });
                }
              });

              if (dependentRepositories.length > 0) {
                let message = dependentRepositories.length === 1 ? dependentRepositories[0] : dependentRepositories.length + ' other features';
                Core.notification('danger',
                  `Unable to remove repository ${selectedRepository.name}. It is required by ${message}.`)
                return;
              }

              Core.notification('info', `Removing feature repository ${selectedRepository.uri}`);
              this.featuresService.removeFeatureRepository(selectedRepository)
                .then(() => {
                  Core.notification('success', `Removed feature repository ${selectedRepository.uri}`);
                  this.loadFeatureRepositories();
                })
                .catch(error => Core.notification('danger', error));
            }
          });
      }
    };

    toolbarConfig = {
      filterConfig: {
        fields: [
          {
            id: 'name',
            title: 'Name',
            placeholder: 'Filter by name...',
            filterType: 'text'
          },
          {
            id: 'state',
            title: 'State',
            placeholder: 'Filter by state...',
            filterType: 'select',
            filterValues: [
              'Installed',
              'Uninstalled'
            ]
          },
          {
            id: 'repository',
            title: 'Repository',
            placeholder: 'Filter by repository...',
            filterType: 'select'
          }
        ],
        onFilterChange: (filters: any[]) => {
          this.applyFilters(filters);
        },
        appliedFilters: [],
        resultsCount: 0
      },
      actionsConfig: {
        primaryActions: this.toolbarActions()
      },
      isTableView: false
    };

    constructor(private featuresService: FeaturesService, private $uibModal: angular.ui.bootstrap.IModalService, private workspace: Jmx.Workspace) {
      'ngInject';
    }

    $onInit() {
      this.loadFeatureRepositories();
    }

    private itemActionButtons(): any[] {
      let buttons = [];
      let featuresMBean = getSelectionFeaturesMBean(this.workspace);
      if (this.workspace.hasInvokeRightsForName(featuresMBean, 'installFeature')) {
        buttons.push(this.installButton);
      }
      if (this.workspace.hasInvokeRightsForName(featuresMBean, 'uninstallFeature')) {
        buttons.push(this.uninstallButton);
      }
      log.debug("RBAC - Rendered features buttons:", buttons);
      return buttons;
    }

    private toolbarActions(): any[] {
      let actions = [];
      let featuresMBean = getSelectionFeaturesMBean(this.workspace);
      if (this.workspace.hasInvokeRightsForName(featuresMBean, 'addRepository')) {
        actions.push(this.addRepositoryAction);
      }
      if (this.workspace.hasInvokeRightsForName(featuresMBean, 'removeRepository')) {
        actions.push(this.removeRepositoryAction);
      }
      log.debug("RBAC - Rendered features actions:", actions);
      return actions;
    }

    private loadFeatureRepositories() {
      this.featuresService.getFeatureRepositories()
        .then(featureRepositories => {
          this.features = [];

          featureRepositories.forEach(repository => {
            this.features.push.apply(this.features, repository.features);
          });

          this.listItems = this.features.sort(this.featuresService.sortByName);
          this.repositories = featureRepositories.sort(this.featuresService.sortByName);

          this.repositoryFilterValues = this.repositories.map(repository => {
            return repository.name;
          });

          this.toolbarConfig.filterConfig.fields[2]['filterValues'] = this.repositoryFilterValues;

          if (this.toolbarConfig.filterConfig.appliedFilters.length > 0) {
            this.applyFilters(this.toolbarConfig.filterConfig.appliedFilters)
          } else {
            this.toolbarConfig.filterConfig.resultsCount = this.features.length;
          }
          this.loading = false;
        });
    }

    private applyFilters(filters: any[]) {
      let filteredFeatures = this.features;
      filters.forEach(filter => {
        filteredFeatures = FeaturesController.FILTER_FUNCTIONS[filter.id](filteredFeatures, filter.value);
      });
      this.listItems = filteredFeatures;
      this.toolbarConfig.filterConfig.resultsCount = filteredFeatures.length;
    }

    enableButtonForItem(action, item) {
      if (this['config']['updateInProgress'] === true) {
        return false;
      }

      if (action.name === 'Install') {
        return item.installed === false;
      }

      if (action.name === 'Uninstall') {
        return item.installed === true;
      }
    }
  }

  export const featuresComponent: angular.IComponentOptions = {
    templateUrl: 'plugins/karaf/html/features.html',
    controller: FeaturesController
  };
}

