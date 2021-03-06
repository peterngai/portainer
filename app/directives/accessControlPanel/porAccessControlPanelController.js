angular.module('portainer')
.controller('porAccessControlPanelController', ['$q', '$state', 'UserService', 'TeamService', 'ResourceControlService', 'Notifications', 'Authentication', 'ModalService', 'FormValidator',
function ($q, $state, UserService, TeamService, ResourceControlService, Notifications, Authentication, ModalService, FormValidator) {

  var ctrl = this;

  ctrl.state = {
    displayAccessControlPanel: false,
    canEditOwnership: false,
    editOwnership: false,
    formValidationError: ''
  };

  ctrl.formValues = {
    Ownership: 'public',
    Ownership_Users: [],
    Ownership_Teams: []
  };

  ctrl.authorizedUsers = [];
  ctrl.availableUsers = [];
  ctrl.authorizedTeams = [];
  ctrl.availableTeams = [];

  ctrl.confirmUpdateOwnership = function (force) {
    if (!validateForm()) {
      return;
    }
    ModalService.confirmAccessControlUpdate(function (confirmed) {
      if(!confirmed) { return; }
      updateOwnership();
    });
  };

  function validateForm() {
    ctrl.state.formValidationError = '';
    var error = '';

    var accessControlData = {
      AccessControlEnabled: ctrl.formValues.Ownership === 'public' ? false : true,
      Ownership: ctrl.formValues.Ownership,
      AuthorizedUsers: ctrl.formValues.Ownership_Users,
      AuthorizedTeams: ctrl.formValues.Ownership_Teams
    };
    var isAdmin = ctrl.isAdmin;
    error = FormValidator.validateAccessControl(accessControlData, isAdmin);
    if (error) {
      ctrl.state.formValidationError = error;
      return false;
    }
    return true;
  }

  function processOwnershipFormValues() {
    var userIds = [];
    angular.forEach(ctrl.formValues.Ownership_Users, function(user) {
      userIds.push(user.Id);
    });
    var teamIds = [];
    angular.forEach(ctrl.formValues.Ownership_Teams, function(team) {
      teamIds.push(team.Id);
    });
    var administratorsOnly = ctrl.formValues.Ownership === 'administrators' ? true : false;

    return {
      ownership: ctrl.formValues.Ownership,
      authorizedUserIds: administratorsOnly ? [] : userIds,
      authorizedTeamIds: administratorsOnly ? [] : teamIds,
      administratorsOnly: administratorsOnly
    };
  }

  function updateOwnership() {
    $('#loadingViewSpinner').show();

    var resourceId = ctrl.resourceId;
    var ownershipParameters = processOwnershipFormValues();

    ResourceControlService.applyResourceControlChange(ctrl.resourceType, resourceId,
      ctrl.resourceControl, ownershipParameters)
    .then(function success(data) {
      Notifications.success('Access control successfully updated');
      $state.reload();
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to update access control');
    })
    .finally(function final() {
      $('#loadingViewSpinner').hide();
    });
  }

  function initComponent() {
    $('#loadingViewSpinner').show();

    var userDetails = Authentication.getUserDetails();
    var isAdmin = userDetails.role === 1 ? true: false;
    var userId = userDetails.ID;
    ctrl.isAdmin = isAdmin;
    var resourceControl = ctrl.resourceControl;

    if (isAdmin) {
      if (resourceControl) {
        ctrl.formValues.Ownership = resourceControl.Ownership === 'private' ? 'restricted' : resourceControl.Ownership;
      } else {
        ctrl.formValues.Ownership = 'public';
      }
    } else {
      ctrl.formValues.Ownership = 'public';
    }

    ResourceControlService.retrieveOwnershipDetails(resourceControl)
    .then(function success(data) {
      ctrl.authorizedUsers = data.authorizedUsers;
      ctrl.authorizedTeams = data.authorizedTeams;
      return ResourceControlService.retrieveUserPermissionsOnResource(userId, isAdmin, resourceControl);
    })
    .then(function success(data) {
      ctrl.state.canEditOwnership = data.isPartOfRestrictedUsers || data.isLeaderOfAnyRestrictedTeams;
      ctrl.state.canChangeOwnershipToTeam = data.isPartOfRestrictedUsers;

      return $q.all({
        availableUsers: isAdmin ? UserService.users(false) : [],
        availableTeams: isAdmin || data.isPartOfRestrictedUsers ? TeamService.teams() : []
      });
    })
    .then(function success(data) {
      ctrl.availableUsers = data.availableUsers;
      angular.forEach(ctrl.availableUsers, function(user) {
        var found = _.find(ctrl.authorizedUsers, { Id: user.Id });
        if (found) {
          user.selected = true;
        }
      });
      ctrl.availableTeams = data.availableTeams;
      angular.forEach(data.availableTeams, function(team) {
        var found = _.find(ctrl.authorizedTeams, { Id: team.Id });
        if (found) {
          team.selected = true;
        }
      });
      if (data.availableTeams.length === 1) {
        ctrl.formValues.Ownership_Teams.push(data.availableTeams[0]);
      }
      ctrl.state.displayAccessControlPanel = true;
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve access control information');
    })
    .finally(function final() {
      $('#loadingViewSpinner').hide();
    });
  }

  initComponent();
}]);
