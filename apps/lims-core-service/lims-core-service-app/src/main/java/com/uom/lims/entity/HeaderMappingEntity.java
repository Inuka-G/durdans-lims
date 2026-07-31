package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "header_mapping")
public class HeaderMappingEntity extends BaseEntity {

    @Column(name = "role_name", nullable = false)
    private String roleName;

    @Column(name = "display_text", nullable = false)
    private String displayText;

    @Column(name = "link_url", nullable = false)
    private String linkUrl;

    @Column(name = "priority")
    private Integer priority = 0;
}
