package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.dto.response.AgentPatientVerifyResponse;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentPatientVerifyServiceTest {

    @Mock
    private PatientRepository patientRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private AgentOrderStatusService orderStatusService;

    @InjectMocks
    private AgentPatientVerifyService service;

    private static PatientEntity patient() {
        PatientEntity patient = new PatientEntity();
        patient.setPatientCode("PAT-001");
        patient.setFullName("M. Nimal Perera");
        patient.setPhone("0771234567");
        patient.setIdentityNumber("912345678V");
        return patient;
    }

    private static AgentOrderStatusResponse describedOrder() {
        return new AgentOrderStatusResponse(true, "ORD-20260816-010000", "Colombo 3", "PROCESSING",
                false, 2, 0, LocalDate.of(2026, 8, 16), List.of());
    }

    @Test
    void possessionPlusNameAndNicVerifiesAndReturnsRecentOrders() {
        when(patientRepository.findByPhoneEndingWith("771234567")).thenReturn(List.of(patient()));
        OrderEntity order = new OrderEntity();
        when(orderRepository.findAllByPatientIdAndDeletedFalse(eq("PAT-001"), any()))
                .thenReturn(new PageImpl<>(List.of(order)));
        when(orderStatusService.describe(order)).thenReturn(describedOrder());

        AgentPatientVerifyResponse response = service.verify("94771234567", "912345678v", "Nimal Perera");

        assertThat(response.verified()).isTrue();
        assertThat(response.firstName()).isEqualTo("Nimal");
        assertThat(response.recentOrders()).singleElement()
                .satisfies(o -> assertThat(o.branchName()).isEqualTo("Colombo 3"));
    }

    @Test
    void nicWithoutTheTrailingLetterStillMatches() {
        when(patientRepository.findByPhoneEndingWith("771234567")).thenReturn(List.of(patient()));
        when(orderRepository.findAllByPatientIdAndDeletedFalse(eq("PAT-001"), any()))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service.verify("+94 77 123 4567", "912345678", "perera").verified()).isTrue();
    }

    @Test
    void wrongNicIsNotVerifiedAndRevealsNothing() {
        when(patientRepository.findByPhoneEndingWith("771234567")).thenReturn(List.of(patient()));

        AgentPatientVerifyResponse response = service.verify("94771234567", "912345679V", "Nimal Perera");

        assertThat(response).isEqualTo(AgentPatientVerifyResponse.notVerified());
        verify(orderRepository, never()).findAllByPatientIdAndDeletedFalse(any(), any());
    }

    @Test
    void wrongNameIsNotVerifiedEvenWithTheRightNic() {
        when(patientRepository.findByPhoneEndingWith("771234567")).thenReturn(List.of(patient()));

        assertThat(service.verify("94771234567", "912345678V", "Kamal Silva").verified()).isFalse();
    }

    @Test
    void unknownPhoneLooksExactlyLikeAWrongNic() {
        when(patientRepository.findByPhoneEndingWith("770000000")).thenReturn(List.of());

        assertThat(service.verify("94770000000", "912345678V", "Nimal Perera"))
                .isEqualTo(AgentPatientVerifyResponse.notVerified());
    }

    @Test
    void aCandidateWhoseFullNumberDiffersIsRejectedByTheDigitsCompare() {
        // Ending-with is the database pre-filter; the digits compare is the decision.
        PatientEntity other = patient();
        other.setPhone("0111234567"); // same nine-digit tail would be impossible here, but be explicit
        lenient().when(patientRepository.findByPhoneEndingWith("771234567")).thenReturn(List.of(other));

        assertThat(service.verify("94771234567", "912345678V", "Nimal Perera").verified()).isFalse();
    }

    @Test
    void helpersNormaliseTheWayPeopleActuallySayThings() {
        assertThat(AgentPatientVerifyService.identityMatches("912345678V", " 912345678 ")).isTrue();
        assertThat(AgentPatientVerifyService.identityMatches("200012345678", "2000 1234 5678")).isTrue();
        assertThat(AgentPatientVerifyService.identityMatches("912345678V", "45678")).isFalse();
        assertThat(AgentPatientVerifyService.nameMatches("M. Nimal Perera", "NIMAL")).isTrue();
        assertThat(AgentPatientVerifyService.nameMatches("M. Nimal Perera", "M.")).isFalse();
        assertThat(AgentPatientVerifyService.firstNameOf("M. Nimal Perera")).isEqualTo("Nimal");
    }
}
