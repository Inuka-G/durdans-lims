    public Page<BranchUserResponse> searchBranchUsers(String branchId, String keyword, Boolean isActive, Pageable pageable) {
        try {
            if (!SecurityUtils.hasRole("SUPER_ADMIN")) {
                branchId = SecurityUtils.getCurrentBranchId(); // Enforce branch context
            }

            final String finalBranchId = branchId;
            List<BranchUserResponse> responses = new java.util.ArrayList<>();
            
            // Pre-fetch local phone numbers as a fallback since old users might not have phone saved in Keycloak
            java.util.List<BranchUserEntity> localUsers = repository.findByBranchId(finalBranchId);
            java.util.Map<String, String> localPhoneMap = localUsers.stream()
                .filter(u -> u.getKeycloakId() != null && u.getPhone() != null)
                .collect(java.util.stream.Collectors.toMap(BranchUserEntity::getKeycloakId, BranchUserEntity::getPhone, (p1, p2) -> p1));

            keycloakAdminServiceProvider.ifAvailable(service -> {
                List<org.keycloak.representations.idm.UserRepresentation> kcUsers = service.getUsersByBranch(finalBranchId);
                
                for (org.keycloak.representations.idm.UserRepresentation user : kcUsers) {
                    // Filter by keyword
                    if (keyword != null && !keyword.trim().isEmpty()) {
                        String lowerKeyword = keyword.toLowerCase();
                        boolean matches = false;
                        if (user.getFirstName() != null && user.getFirstName().toLowerCase().contains(lowerKeyword)) matches = true;
                        if (user.getLastName() != null && user.getLastName().toLowerCase().contains(lowerKeyword)) matches = true;
                        if (user.getEmail() != null && user.getEmail().toLowerCase().contains(lowerKeyword)) matches = true;
                        if (user.getUsername() != null && user.getUsername().toLowerCase().contains(lowerKeyword)) matches = true;
                        if (!matches) continue;
                    }
                    
                    // Filter by isActive
                    if (isActive != null) {
                        boolean userActive = Boolean.TRUE.equals(user.isEnabled());
                        if (userActive != isActive) continue;
                    }
                    
                    // Fetch roles and filter out BRANCH_ADMIN
                    List<String> roles = service.getUserRoles(user.getId());
                    if (roles.contains("BRANCH_ADMIN") || roles.contains("ROLE_BRANCH_ADMIN")) {
                        continue;
                    }
                    
                    BranchUserResponse mappedResponse = mapToResponse(user, finalBranchId, roles);
                    if (mappedResponse.getPhone() == null || mappedResponse.getPhone().isEmpty()) {
                        mappedResponse.setPhone(localPhoneMap.get(user.getId()));
                    }
                    responses.add(mappedResponse);
                }
            });

            // In-memory pagination
            int start = (int) pageable.getOffset();
            int end = Math.min((start + pageable.getPageSize()), responses.size());
            List<BranchUserResponse> pageContent = new java.util.ArrayList<>();
            if (start <= end) {
                pageContent = responses.subList(start, end);
            }

            return new org.springframework.data.domain.PageImpl<>(pageContent, pageable, responses.size());
        } catch (Exception e) {
            try {
                java.nio.file.Files.writeString(java.nio.file.Paths.get("error2.log"), e.toString() + "\n" + java.util.Arrays.toString(e.getStackTrace()));
            } catch (Exception ignored) {}
            throw e;
        }
    }
