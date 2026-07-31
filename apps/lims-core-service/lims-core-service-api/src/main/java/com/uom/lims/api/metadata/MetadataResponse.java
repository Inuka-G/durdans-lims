package com.uom.lims.api.metadata;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MetadataResponse {
    private String currentBranchName;
    private String currentBranchCode;
    private List<NavItem> navItems;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NavItem {
        private String displayText;
        private String linkUrl;
    }
}
