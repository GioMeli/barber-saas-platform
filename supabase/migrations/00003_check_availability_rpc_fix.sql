-- Function to calculate availability on the server side
create or replace function check_availability(
  p_business_id uuid,
  p_employee_id uuid,
  p_date date,
  p_duration int
)
returns table (
  available_time time
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_day_of_week int;
  v_start_time time;
  v_end_time time;
  v_is_closed boolean;
  v_interval int;
  v_current_time time;
  v_conflict_exists boolean;
begin
  -- Get day of week (0 = Sunday, 1 = Monday, ...)
  v_day_of_week := extract(dow from p_date);
  
  -- Get booking interval
  select booking_interval into v_interval
  from business_settings
  where business_id = p_business_id;
  
  if v_interval is null then
    v_interval := 30; -- default
  end if;

  -- Get working hours for employee or business
  select start_time, end_time, is_closed
  into v_start_time, v_end_time, v_is_closed
  from working_hours
  where business_id = p_business_id
    and (employee_id = p_employee_id or employee_id is null)
    and day_of_week = v_day_of_week
  order by employee_id nulls last
  limit 1;
  
  if not found or v_is_closed then
    return; -- No availability
  end if;

  -- Initialize current time to start of working hours
  v_current_time := v_start_time;

  -- Loop through time slots
  while v_current_time + (p_duration || ' minutes')::interval <= v_end_time loop
    
    -- Check for conflicts with existing appointments
    select exists (
      select 1
      from appointments a
      where a.business_id = p_business_id
        and a.employee_id = p_employee_id
        and a.status not in ('cancelled_by_customer', 'cancelled_by_business', 'no_show')
        and a.start_time::date = p_date
        and (
          (v_current_time >= a.start_time::time and v_current_time < a.end_time::time) or
          (v_current_time + (p_duration || ' minutes')::interval > a.start_time::time and v_current_time + (p_duration || ' minutes')::interval <= a.end_time::time) or
          (v_current_time <= a.start_time::time and v_current_time + (p_duration || ' minutes')::interval >= a.end_time::time)
        )
    ) into v_conflict_exists;

    -- Check for conflicts with breaks
    if not v_conflict_exists then
      select exists (
        select 1
        from breaks b
        where b.employee_id = p_employee_id
          and b.day_of_week = v_day_of_week
          and (
            (v_current_time >= b.start_time and v_current_time < b.end_time) or
            (v_current_time + (p_duration || ' minutes')::interval > b.start_time and v_current_time + (p_duration || ' minutes')::interval <= b.end_time) or
            (v_current_time <= b.start_time and v_current_time + (p_duration || ' minutes')::interval >= b.end_time)
          )
      ) into v_conflict_exists;
    end if;

    -- If no conflict, add to results
    if not v_conflict_exists then
      available_time := v_current_time;
      return next;
    end if;

    -- Increment by interval
    v_current_time := v_current_time + (v_interval || ' minutes')::interval;
  end loop;

  return;
end;
$$;