package com.uom.lims.service;

import com.uom.lims.api.enums.TubeType;
import com.uom.lims.entity.SupplyEntity;
import com.uom.lims.repository.SupplyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

import java.util.EnumMap;
import java.util.Map;

/**
 * WHY: The tube swatch printed on a bedside label is inventory data — it lives on the
 * supply row that owns the tube type — so no client or service may carry its own
 * tube-to-colour table and drift from what the storeroom actually stocks.
 *
 * <p>Scoped to the request because a paginated worklist maps many samples but draws
 * from at most one supply row per tube type: resolving through this bean turns what
 * would be a lookup per row into a lookup per distinct tube, and the cache dies with
 * the request so an inventory edit is visible on the very next call.
 */
@Component
@RequestScope
@RequiredArgsConstructor
public class TubeColorResolver {

    private final SupplyRepository supplyRepository;

    // Misses are cached too — an unstocked tube must not be re-queried for every row.
    private final Map<TubeType, String> resolved = new EnumMap<>(TubeType.class);

    /**
     * WHY: A tube with no supply row is a real state while inventory is being set up,
     * and inventing a colour here would put a wrong swatch on a specimen label. Callers
     * get null and fall back to a neutral swatch of their own.
     *
     * @param tubeType the tube the specimen is drawn into, may be null
     * @return the colour recorded on the matching non-deleted supply row, or null when there is none
     */
    public String resolve(TubeType tubeType) {
        if (tubeType == null) {
            return null;
        }
        if (!resolved.containsKey(tubeType)) {
            resolved.put(tubeType, supplyRepository.findByTubeTypeAndDeletedFalse(tubeType)
                    .map(SupplyEntity::getTubeColor)
                    .orElse(null));
        }
        return resolved.get(tubeType);
    }
}
